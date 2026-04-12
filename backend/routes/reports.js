const express = require('express');
const dayjs = require('dayjs');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const DailyReport = require('../models/DailyReport');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { requireAuth, authorizeRoles } = require('../middleware/auth');
const { sendDiscordNotification } = require('../utils/discord');
const { logAudit } = require('../utils/audit');

const router = express.Router();

// Get the latest closing reports
router.get('/', requireAuth, async (req, res) => {
  try {
    const reports = await DailyReport.find()
      .sort({ date: -1 })
      .limit(30);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reports', error: err.message });
  }
});

// Get detailed transactions for a specific closure
router.get('/:id/details', requireAuth, async (req, res) => {
  try {
    const report = await DailyReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });

    const startOfDay = dayjs(report.date).startOf('day').toDate();
    const endOfDay = dayjs(report.date).endOf('day').toDate();

    const transactions = await Transaction.find({
      date: { $gte: startOfDay, $lte: endOfDay }
    }).populate('ledgerId', 'name type').sort({ createdAt: 1 });

    res.json({
      report,
      transactions
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch report details', error: err.message });
  }
});

// Calculate current status for "Closing" preview
router.get('/preview', requireAuth, async (req, res) => {
  try {
    const todayStr = req.query.date || dayjs().format('YYYY-MM-DD');
    const todayStart = dayjs(todayStr).startOf('day').toDate();
    const todayEnd = dayjs(todayStr).endOf('day').toDate();

    // 1. Get stats for requested day
    const stats = await Transaction.aggregate([
      { $match: { date: { $gte: todayStart, $lte: todayEnd } } },
      {
        $group: {
          _id: null,
          income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          outgoing: { $sum: { $cond: [{ $eq: ['$type', 'outgoing'] }, '$amount', 0] } },
          count: { $sum: 1 },
        },
      },
    ]);

    const dayData = stats[0] || { income: 0, outgoing: 0, count: 0 };

    // 2. Get the last locked report for opening balance
    const lastReport = await DailyReport.findOne({ 
      date: { $lt: todayStart } 
    }).sort({ date: -1 });

    const openingBalance = lastReport ? lastReport.closingBalance : 0;
    const closingBalance = openingBalance + dayData.income - dayData.outgoing;

    res.json({
      date: todayStr,
      openingBalance,
      totalIncome: dayData.income,
      totalOutgoing: dayData.outgoing,
      closingBalance,
      transactionCount: dayData.count,
      isAlreadyLocked: !!(await DailyReport.findOne({ date: { $gte: todayStart, $lte: todayEnd } })),
      lastReportDate: lastReport?.date
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate preview', error: err.message });
  }
});

// Perform "Shop Closure"
router.post('/close-day', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const { date, notes } = req.body;
    const targetDate = dayjs(date || dayjs().format('YYYY-MM-DD')).startOf('day').toDate();
    const targetEnd = dayjs(targetDate).endOf('day').toDate();

    // Check if already locked
    const existing = await DailyReport.findOne({ 
      date: { $gte: targetDate, $lte: targetEnd } 
    });
    if (existing) {
      return res.status(400).json({ message: 'This day is already closed and locked.' });
    }

    // Calculate totals (identical to preview)
    const stats = await Transaction.aggregate([
      { $match: { date: { $gte: targetDate, $lte: targetEnd } } },
      {
        $group: {
          _id: null,
          income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          outgoing: { $sum: { $cond: [{ $eq: ['$type', 'outgoing'] }, '$amount', 0] } },
          count: { $sum: 1 },
        },
      },
    ]);

    const dayData = stats[0] || { income: 0, outgoing: 0, count: 0 };
    const lastReport = await DailyReport.findOne({ date: { $lt: targetDate } }).sort({ date: -1 });
    const openingBalance = lastReport ? lastReport.closingBalance : 0;
    const closingBalance = openingBalance + dayData.income - dayData.outgoing;

    const report = await DailyReport.create({
      date: targetDate,
      openingBalance,
      totalIncome: dayData.income,
      totalOutgoing: dayData.outgoing,
      closingBalance,
      transactionCount: dayData.count,
      generatedBy: req.user.username || req.user.name,
      notes,
      status: 'locked'
    });

    // Audit Log and Discord Notification
    try {
      await sendDiscordNotification({
        action: 'CLOSE_DAY',
        after: report.toObject(),
      });
    } catch (discordErr) {
      console.error('Failed to send Discord report:', discordErr);
    }

    await logAudit({
      req,
      entityType: 'report',
      entityId: String(report._id),
      action: 'CLOSE_DAY',
      userId: String(req.user.id),
      userName: req.user.username,
      role: req.user.role,
      status: 'SUCCESS',
      description: `Closed day ${dayjs(targetDate).format('YYYY-MM-DD')}. Closing Balance: ৳${closingBalance.toLocaleString()}`,
      after: report.toObject()
    });

    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ message: 'Failed to close day', error: err.message });
  }
});

// Revert "Shop Closure" (Unlock Day)
router.post('/:id/revert', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Password confirmation is required to revert closure.' });
    }

    // 1. Verify User Password
    const mongoose = require('mongoose');
    let userQuery = { username: req.user.username };
    
    // If we have a valid-looking ID, we can use it, otherwise stick to username
    if (req.user.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
      userQuery = { _id: req.user.id };
    }

    const user = await User.findOne(userQuery);
    
    if (!user) {
      console.error('[Revert Error] Admin user not found for query:', userQuery);
      return res.status(404).json({ message: 'Internal Error: Could not verify admin account.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password. Revert denied.' });
    }

    // 2. Find and Delete the Report
    const report = await DailyReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });

    await DailyReport.findByIdAndDelete(req.params.id);

    // 3. Audit Log
    await logAudit({
      req,
      entityType: 'report',
      entityId: String(report._id),
      action: 'REVERT_CLOSE_DAY',
      userId: String(req.user.id),
      userName: req.user.username,
      role: req.user.role,
      status: 'SUCCESS',
      description: `Reverted closure for ${dayjs(report.date).format('YYYY-MM-DD')}. Day is now UNLOCKED.`,
      before: report.toObject()
    });

    res.json({ message: 'Closure successfully reverted. Records are now unlocked.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to revert closure', error: err.message });
  }
});

module.exports = router;
