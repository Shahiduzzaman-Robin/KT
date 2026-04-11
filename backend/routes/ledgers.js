const express = require('express');
const dayjs = require('dayjs');
const Ledger = require('../models/Ledger');
const Transaction = require('../models/Transaction');
const { logAudit } = require('../utils/audit');
const { sendDiscordNotification } = require('../utils/discord');
const { requireAuth, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseBoolean(value, defaultValue = false) {
  if (value == null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  return defaultValue;
}

function buildLedgerTransactionQuery({ ledgerId, type, from, to, minAmount, maxAmount, search }) {
  const query = { ledgerId };

  if (type && ['income', 'outgoing'].includes(type)) {
    query.type = type;
  }

  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = dayjs(from).startOf('day').toDate();
    if (to) query.date.$lte = dayjs(to).endOf('day').toDate();
  }

  if (minAmount || maxAmount) {
    query.amount = {};
    if (minAmount) query.amount.$gte = Number(minAmount);
    if (maxAmount) query.amount.$lte = Number(maxAmount);
  }

  const trimmedSearch = String(search || '').trim();
  if (trimmedSearch) {
    query.description = {
      $regex: escapeRegExp(trimmedSearch),
      $options: 'i',
    };
  }

  return query;
}

router.get('/', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const type = (req.query.type || '').trim();
    const includeArchived = parseBoolean(req.query.includeArchived, false);
    const limit = Math.min(Number(req.query.limit) || 20, 5000);

    const query = {};
    if (!includeArchived) {
      query.isActive = true;
    }
    if (type) query.type = type;
    if (search) {
      query.name = { $regex: `^${escapeRegExp(search)}`, $options: 'i' };
    }

    const ledgers = await Ledger.find(query)
      .sort({ name: 1 })
      .limit(limit)
      .lean();

    const ledgerIds = ledgers.map((ledger) => ledger._id);
    const stats = await Transaction.aggregate([
      { $match: { ledgerId: { $in: ledgerIds } } },
      {
        $group: {
          _id: '$ledgerId',
          income: {
            $sum: {
              $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0],
            },
          },
          outgoing: {
            $sum: {
              $cond: [{ $eq: ['$type', 'outgoing'] }, '$amount', 0],
            },
          },
          lastTransactionAt: { $max: '$date' },
        },
      },
    ]);

    const statsMap = new Map(
      stats.map((entry) => [
        String(entry._id),
        {
          balance: Number(entry.income || 0) - Number(entry.outgoing || 0),
          lastTransactionAt: entry.lastTransactionAt,
        },
      ])
    );

    const enrichedLedgers = ledgers.map((ledger) => {
      const s = statsMap.get(String(ledger._id)) || { balance: 0, lastTransactionAt: null };
      return {
        ...ledger,
        currentBalance: s.balance,
        lastTransactionAt: s.lastTransactionAt,
      };
    });

    res.json(enrichedLedgers);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch ledgers', error: error.message });
  }
});

router.get('/:id/summary', async (req, res) => {
  try {
    const ledger = await Ledger.findById(req.params.id).lean();
    if (!ledger) return res.status(404).json({ message: 'Ledger not found' });

    const aggregates = await Transaction.aggregate([
      { $match: { ledgerId: ledger._id } },
      {
        $group: {
          _id: null,
          totalIncoming: {
            $sum: {
              $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0],
            },
          },
          totalOutgoing: {
            $sum: {
              $cond: [{ $eq: ['$type', 'outgoing'] }, '$amount', 0],
            },
          },
          transactionCount: { $sum: 1 },
          lastTransactionAt: { $max: '$date' },
        },
      },
    ]);

    const summary = aggregates[0] || {
      totalIncoming: 0,
      totalOutgoing: 0,
      transactionCount: 0,
      lastTransactionAt: null,
    };

    const totalIncoming = Number(summary.totalIncoming || 0);
    const totalOutgoing = Number(summary.totalOutgoing || 0);

    res.json({
      ledger: {
        _id: ledger._id,
        name: ledger.name,
        type: ledger.type,
        contact: ledger.contact || '',
        address: ledger.address || '',
        notes: ledger.notes || '',
        isActive: ledger.isActive !== false,
        isGroup: ledger.isGroup === true,
        isPosting: ledger.isPosting === true,
      },
      totalIncoming,
      totalOutgoing,
      balance: totalIncoming - totalOutgoing,
      transactionCount: Number(summary.transactionCount || 0),
      lastTransactionAt: summary.lastTransactionAt || null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch ledger summary', error: error.message });
  }
});

router.get('/:id/transactions', async (req, res) => {
  try {
    const ledger = await Ledger.findById(req.params.id).select('_id').lean();
    if (!ledger) return res.status(404).json({ message: 'Ledger not found' });

    const {
      type,
      from,
      to,
      minAmount,
      maxAmount,
      search,
      page = 1,
      limit = 100,
    } = req.query;

    const query = buildLedgerTransactionQuery({
      ledgerId: ledger._id,
      type,
      from,
      to,
      minAmount,
      maxAmount,
      search,
    });

    const pageNumber = Math.max(Number(page), 1);
    const pageSize = Math.min(Math.max(Number(limit), 1), 200);

    const [items, total] = await Promise.all([
      Transaction.find(query)
        .populate('ledgerId', 'name type isActive')
        .sort({ date: -1, createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),
      Transaction.countDocuments(query),
    ]);

    res.json({
      items,
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch ledger transactions', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const ledger = await Ledger.findById(req.params.id);
    if (!ledger) return res.status(404).json({ message: 'Ledger not found' });
    res.json(ledger);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch ledger', error: error.message });
  }
});

router.post('/', requireAuth, authorizeRoles('admin', 'data-entry'), async (req, res) => {
  try {
    const userName = req.user.username || req.user.name;
    const role = req.user.role;

    const ledger = await Ledger.create(req.body);
    await logAudit({
      req,
      entityType: 'ledger',
      entityId: String(ledger._id),
      action: 'CREATE_LEDGER',
      userId: String(req.user.id || ''),
      userName,
      role,
      status: 'SUCCESS',
      description: `Created ledger ${ledger.name}`,
      after: ledger.toObject(),
    });

    // Send Discord notification (fire-and-forget)
    sendDiscordNotification({
      action: 'CREATE_LEDGER',
      ledger,
      user: { username: userName, role },
    }).catch(() => {});

    res.status(201).json(ledger);
  } catch (error) {
    res.status(400).json({ message: 'Failed to create ledger', error: error.message });
  }
});

router.put('/:id', requireAuth, authorizeRoles('admin', 'data-entry'), async (req, res) => {
  try {
    const userName = req.user.username || req.user.name;
    const role = req.user.role;

    const before = await Ledger.findById(req.params.id).lean();
    if (!before) return res.status(404).json({ message: 'Ledger not found' });

    const ledger = await Ledger.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await logAudit({
      req,
      entityType: 'ledger',
      entityId: String(ledger._id),
      action: 'UPDATE_LEDGER',
      userId: String(req.user.id || ''),
      userName,
      role,
      status: 'SUCCESS',
      description: `Updated ledger ${ledger.name}`,
      before,
      after: ledger.toObject(),
    });

    // Send Discord notification (fire-and-forget)
    sendDiscordNotification({
      action: 'UPDATE_LEDGER',
      ledger,
      changes: {
        before,
        after: ledger.toObject(),
      },
      user: { username: userName, role },
    }).catch(() => {});

    res.json(ledger);
  } catch (error) {
    res.status(400).json({ message: 'Failed to update ledger', error: error.message });
  }
});

router.delete('/:id', requireAuth, authorizeRoles('admin', 'data-entry'), async (req, res) => {
  try {
    const userName = req.user.username || req.user.name;
    const role = req.user.role;

    const before = await Ledger.findById(req.params.id).lean();
    if (!before) return res.status(404).json({ message: 'Ledger not found' });

    const linkedTransactionCount = await Transaction.countDocuments({ ledgerId: before._id });

    if (linkedTransactionCount > 0) {
      const ledger = await Ledger.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true, runValidators: true }
      );

      await logAudit({
        req,
        entityType: 'ledger',
        entityId: String(before._id),
        action: 'ARCHIVE_LEDGER',
        userId: String(req.user.id || ''),
        userName,
        role,
        status: 'SUCCESS',
        description: `Archived ledger ${before.name} (${linkedTransactionCount} linked transactions)`,
        before,
        after: ledger.toObject(),
      });

      // Send Discord notification (fire-and-forget)
      sendDiscordNotification({
        action: 'ARCHIVE_LEDGER',
        ledger: before,
        user: { username: userName, role },
      }).catch(() => {});

      return res.json({
        message: `Ledger archived because it has ${linkedTransactionCount} linked transactions`,
        archived: true,
        transactionCount: linkedTransactionCount,
        ledger,
      });
    }

    await Ledger.findByIdAndDelete(req.params.id);

    await logAudit({
      req,
      entityType: 'ledger',
      entityId: String(before._id),
      action: 'DELETE_LEDGER',
      userId: String(req.user.id || ''),
      userName,
      role,
      status: 'SUCCESS',
      description: `Deleted ledger ${before.name}`,
      before,
      after: null,
    });

    // Send Discord notification (fire-and-forget)
    sendDiscordNotification({
      action: 'DELETE_LEDGER',
      ledger: before,
      user: { username: userName, role },
    }).catch(() => {});

    res.json({ message: 'Ledger deleted', archived: false, transactionCount: 0 });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete ledger', error: error.message });
  }
});

module.exports = router;
