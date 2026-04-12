const express = require('express');
const dayjs = require('dayjs');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const DailyReport = require('../models/DailyReport');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Loan = require('../models/Loan');
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

    // 2. Calculate Opening Balance with smart "Gap Catch-up"
    const lastReport = await DailyReport.findOne({ 
      date: { $lt: todayStart } 
    }).sort({ date: -1 });

    let openingBalance = 0;
    if (lastReport) {
      // Find any transactions that happened between the last report and today (The "Gap")
      const lastReportEnd = dayjs(lastReport.date).endOf('day').toDate();
      const gapStats = await Transaction.aggregate([
        { $match: { date: { $gt: lastReportEnd, $lt: todayStart } } },
        {
          $group: {
            _id: null,
            income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
            outgoing: { $sum: { $cond: [{ $eq: ['$type', 'outgoing'] }, '$amount', 0] } },
          },
        },
      ]);
      const gapData = gapStats[0] || { income: 0, outgoing: 0 };
      openingBalance = lastReport.closingBalance + gapData.income - gapData.outgoing;
    } else {
      // No previous report exists - calculate balance of all transactions before today
      const legacyStats = await Transaction.aggregate([
        { $match: { date: { $lt: todayStart } } },
        {
          $group: {
            _id: null,
            income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
            outgoing: { $sum: { $cond: [{ $eq: ['$type', 'outgoing'] }, '$amount', 0] } },
          },
        },
      ]);
      const legacyData = legacyStats[0] || { income: 0, outgoing: 0 };
      openingBalance = legacyData.income - legacyData.outgoing;
    }

    const closingBalance = openingBalance + dayData.income - dayData.outgoing;

    // 3. Calculate Outstanding Loans
    const activeLoans = await Loan.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, total: { $sum: '$remainingAmount' } } }
    ]);
    const totalLoanOutstanding = activeLoans[0]?.total || 0;

    const existingReport = await DailyReport.findOne({ date: { $gte: todayStart, $lte: todayEnd } });
    const nextReport = await DailyReport.findOne({ 
      date: { $gt: todayEnd } 
    }).sort({ date: 1 });

    if (existingReport) {
      return res.json({
        date: todayStr,
        openingBalance: existingReport.openingBalance,
        totalIncome: existingReport.totalIncome,
        totalOutgoing: existingReport.totalOutgoing,
        closingBalance: existingReport.closingBalance,
        totalLoanOutstanding: existingReport.totalLoanOutstanding || 0,
        transactionCount: existingReport.transactionCount,
        isAlreadyLocked: true,
        isImplicitlyLocked: false,
        reportId: existingReport._id,
        lastReportDate: lastReport?.date,
        nextReportDate: nextReport?.date
      });
    }

    res.json({
      date: todayStr,
      openingBalance,
      totalIncome: dayData.income,
      totalOutgoing: dayData.outgoing,
      closingBalance,
      totalLoanOutstanding,
      transactionCount: dayData.count,
      isAlreadyLocked: !!existingReport,
      isImplicitlyLocked: !existingReport && !!nextReport,
      reportId: existingReport?._id,
      lastReportDate: lastReport?.date,
      nextReportDate: nextReport?.date
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate preview', error: err.message });
  }
});

// Perform "Shop Closure"
router.post('/', requireAuth, authorizeRoles('admin'), async (req, res) => {
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
    
    // Smart Gap Catch-up for actual closure
    const lastReport = await DailyReport.findOne({ date: { $lt: targetDate } }).sort({ date: -1 });
    let openingBalance = 0;
    if (lastReport) {
      const lastReportEnd = dayjs(lastReport.date).endOf('day').toDate();
      const gapStats = await Transaction.aggregate([
        { $match: { date: { $gt: lastReportEnd, $lt: targetDate } } },
        {
          $group: {
            _id: null,
            income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
            outgoing: { $sum: { $cond: [{ $eq: ['$type', 'outgoing'] }, '$amount', 0] } },
          },
        },
      ]);
      const gapData = gapStats[0] || { income: 0, outgoing: 0 };
      openingBalance = lastReport.closingBalance + gapData.income - gapData.outgoing;
    } else {
      const legacyStats = await Transaction.aggregate([
        { $match: { date: { $lt: targetDate } } },
        {
          $group: {
            _id: null,
            income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
            outgoing: { $sum: { $cond: [{ $eq: ['$type', 'outgoing'] }, '$amount', 0] } },
          },
        },
      ]);
      const legacyData = legacyStats[0] || { income: 0, outgoing: 0 };
      openingBalance = legacyData.income - legacyData.outgoing;
    }

    const closingBalance = openingBalance + dayData.income - dayData.outgoing;

    // Calculate Outstanding Loans for Closure
    const activeLoans = await Loan.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, total: { $sum: '$remainingAmount' } } }
    ]);
    const totalLoanOutstanding = activeLoans[0]?.total || 0;

    const report = await DailyReport.create({
      date: targetDate,
      openingBalance,
      totalIncome: dayData.income,
      totalOutgoing: dayData.outgoing,
      closingBalance,
      totalLoanOutstanding,
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
    console.error('[REVERT_CRASH]:', err);
    res.status(500).json({ 
      message: 'Critical error during closure reversal', 
      error: err.message,
      stack: err.stack // temporarily include stack to debug the 500
    });
  }
});

module.exports = router;
