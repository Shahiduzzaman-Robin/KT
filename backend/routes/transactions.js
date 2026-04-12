const express = require('express');
const dayjs = require('dayjs');
const Transaction = require('../models/Transaction');
const Ledger = require('../models/Ledger');
const AuditLog = require('../models/AuditLog');
const { logAudit } = require('../utils/audit');
const { emitTransactionsChanged } = require('../utils/realtime');
const { sendDiscordNotification } = require('../utils/discord');
const { requireAuth, authorizeRoles } = require('../middleware/auth');
const DailyReport = require('../models/DailyReport');

const router = express.Router();

// Middleware to check if the transaction date is already locked (Shop Closed)
async function checkIfDayLocked(req, res, next) {
  try {
    let targetDate = req.body?.date;
    
    // If no date in body AND it's a new entry (POST), assume it's for TODAY
    if (!targetDate && req.method === 'POST') {
      targetDate = new Date();
    }

    // If no date in body AND we have a transaction ID (PUT/DELETE), lookup the transaction date
    if (!targetDate && req.params.id) {
      const existing = await Transaction.findById(req.params.id).select('date');
      if (!existing) return next(); // Let the route handle the 404
      targetDate = existing.date;
    }

    if (!targetDate) return next();

    const startOfDay = dayjs(targetDate).startOf('day').toDate();
    const endOfDay = dayjs(targetDate).endOf('day').toDate();

    const isLocked = await DailyReport.findOne({
      date: { $gte: startOfDay },
      status: 'locked'
    }).sort({ date: 1 }); // Find the earliest report that locks this date

    if (isLocked) {
      const lockDate = dayjs(isLocked.date).format('DD MMM YYYY');
      const isExactDay = dayjs(isLocked.date).isSame(startOfDay, 'day');
      
      return res.status(403).json({ 
        message: isExactDay 
          ? `This day (${lockDate}) is already closed and locked. Records are permanent.`
          : `This day is implicitly locked by a subsequent closure on ${lockDate}. Revert that closure first to make changes here.`
      });
    }

    next();
  } catch (err) {
    console.error('[LockCheck Error]:', err);
    res.status(500).json({ message: 'Internal server error during closure check', details: err.message });
  }
}

function isReadableLedgerValue(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value.name || value.type || value._id)
  );
}

function formatLedgerValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (isReadableLedgerValue(value)) {
    if (value.name && value.type) return `${value.name} (${value.type})`;
    if (value.name) return value.name;
    if (value._id && typeof value._id === 'string') return value._id;
  }
  return '';
}

function formatHistorySnapshot(snapshot = {}, fallbackTransaction = null) {
  const currentLedger = fallbackTransaction?.ledgerId?.name || fallbackTransaction?.ledgerId?.title || '';
  const ledgerValue = formatLedgerValue(snapshot.ledgerId) || currentLedger;

  return {
    ledger: ledgerValue,
    type: snapshot.type || '',
    amount: snapshot.amount ?? null,
    date: snapshot.date || '',
    description: snapshot.description || '',
    createdBy: snapshot.createdBy || fallbackTransaction?.createdBy || '',
    updatedBy: snapshot.updatedBy || fallbackTransaction?.updatedBy || '',
    createdByRole: snapshot.createdByRole || fallbackTransaction?.createdByRole || '',
    updatedByRole: snapshot.updatedByRole || fallbackTransaction?.updatedByRole || '',
  };
}

function getReadableTransactionHistoryLabel(action) {
  if (action === 'CREATE_TRANSACTION') return 'Created';
  if (action === 'UPDATE_TRANSACTION') return 'Edited';
  if (action === 'DELETE_TRANSACTION') return 'Deleted';
  return prettyAction(action);
}

function prettyAction(action) {
  return String(action || '')
    .replaceAll('_', ' ')
    .trim();
}

router.get('/', async (req, res) => {
  try {
    const {
      type,
      from,
      to,
      ledgerId,
      minAmount,
      maxAmount,
      page = 1,
      limit = 20,
    } = req.query;

    const query = { 
      // Default: Exclude loan-related transactions from the formal ledger list
      loanId: { $exists: false },
      description: { $not: /loan/i }
    };
    if (type && ['income', 'outgoing'].includes(type)) query.type = type;
    if (ledgerId) query.ledgerId = ledgerId;

    if (from || to) {
      if (!query.date) query.date = {};
      if (from) query.date.$gte = dayjs(from).startOf('day').toDate();
      if (to) query.date.$lte = dayjs(to).endOf('day').toDate();
    }

    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = Number(minAmount);
      if (maxAmount) query.amount.$lte = Number(maxAmount);
    }

    const pageNumber = Math.max(Number(page), 1);
    const pageSize = Math.min(Math.max(Number(limit), 1), 200);

    const [items, total] = await Promise.all([
      Transaction.find(query)
        .populate('ledgerId', 'name type')
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
    res.status(500).json({ message: 'Failed to fetch transactions', error: error.message });
  }
});

router.get('/:id/history', requireAuth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id).populate('ledgerId', 'name type').lean();

    const logs = await AuditLog.find({
      entityType: 'transaction',
      entityId: String(req.params.id),
      action: { $in: ['CREATE_TRANSACTION', 'UPDATE_TRANSACTION', 'DELETE_TRANSACTION'] },
    })
      .sort({ timestamp: 1, createdAt: 1 })
      .lean();

    res.json({
      transaction,
      history: logs.map((log) => ({
        id: String(log._id),
        action: log.action,
        label: getReadableTransactionHistoryLabel(log.action),
        status: log.status || 'SUCCESS',
        timestamp: log.timestamp || log.createdAt,
        userName: log.userName || log.actor || 'system',
        role: log.role || 'data-entry',
        description: log.description || '',
        before: formatHistorySnapshot(log.before || {}, transaction),
        after: formatHistorySnapshot(log.after || {}, transaction),
        metadata: log.metadata || {},
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load transaction history', error: error.message });
  }
});

router.post('/', requireAuth, authorizeRoles('admin', 'data-entry'), checkIfDayLocked, async (req, res) => {
  try {
    const userName = req.user.username || req.user.name;
    const role = req.user.role;

    const ledger = await Ledger.findById(req.body.ledgerId);
    if (!ledger) {
      return res.status(400).json({ message: 'Invalid ledgerId' });
    }
    
    if (ledger.isGroup === true || ledger.isPosting === false) {
      return res.status(400).json({ message: 'Cannot create transaction for a group ledger' });
    }
    if (ledger.isActive === false) {
      return res.status(400).json({ message: 'Cannot create transaction for an archived ledger' });
    }

    if (req.body.counterLedgerId) {
      const counterLedger = await Ledger.findById(req.body.counterLedgerId);
      if (!counterLedger) {
        return res.status(400).json({ message: 'Invalid counterLedgerId' });
      }
      if (counterLedger.isGroup === true || counterLedger.isPosting === false) {
        return res.status(400).json({ message: 'Cannot use a group ledger as counter ledger' });
      }
      if (counterLedger.isActive === false) {
        return res.status(400).json({ message: 'Cannot use an archived ledger as counter ledger' });
      }
    }

    const transaction = await Transaction.create({
      ...req.body,
      createdBy: userName,
      createdByRole: role,
      updatedBy: userName,
      updatedByRole: role,
      source: {
        system: 'manual',
        importKey: null,  // Ensure null (not empty string) to bypass sparse unique index
      },
    });

    await logAudit({
      req,
      entityType: 'transaction',
      entityId: String(transaction._id),
      action: 'CREATE_TRANSACTION',
      userId: String(req.user.id || ''),
      userName,
      role,
      status: 'SUCCESS',
      description: `Created transaction of ৳${transaction.amount} for ${ledger.name}`,
      after: transaction.toObject(),
    });

    emitTransactionsChanged({
      action: 'created',
      transactionId: String(transaction._id),
    });

    const populated = await transaction.populate('ledgerId', 'name type');

    // Send Discord notification (fire-and-forget, don't block response)
    sendDiscordNotification({
      action: 'CREATE_TRANSACTION',
      transaction: populated,
      user: { username: userName, role },
    }).catch(() => {});
    res.status(201).json(populated);
  } catch (error) {
    console.error('Transaction creation error:', error);
    const message = error.message || 'Failed to create transaction';
    let details = '';
    
    if (error.errors) {
      // Mongoose validation errors
      details = Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`).join('; ');
    } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      details = error.message;
    }
    
    const errorResponse = {
      message: 'Failed to create transaction',
      errorType: error.name || 'Unknown',
      details: details || message
    };
    
    res.status(400).json(errorResponse);
  }
});

router.put('/:id', requireAuth, authorizeRoles('admin'), checkIfDayLocked, async (req, res) => {
  try {
    const userName = req.user.username || req.user.name;
    const role = req.user.role;

    const before = await Transaction.findById(req.params.id).populate('ledgerId', 'name type').lean();
    if (!before) return res.status(404).json({ message: 'Transaction not found' });

    if (req.body.ledgerId) {
      const ledger = await Ledger.findById(req.body.ledgerId);
      if (!ledger) return res.status(400).json({ message: 'Invalid ledgerId' });
      if (ledger.isGroup === true || ledger.isPosting === false) {
        return res.status(400).json({ message: 'Cannot move transaction to a group ledger' });
      }
      if (ledger.isActive === false) {
        return res.status(400).json({ message: 'Cannot move transaction to an archived ledger' });
      }
    }

    if (req.body.counterLedgerId) {
      const counterLedger = await Ledger.findById(req.body.counterLedgerId);
      if (!counterLedger) return res.status(400).json({ message: 'Invalid counterLedgerId' });
      if (counterLedger.isGroup === true || counterLedger.isPosting === false) {
        return res.status(400).json({ message: 'Cannot use a group ledger as counter ledger' });
      }
      if (counterLedger.isActive === false) {
        return res.status(400).json({ message: 'Cannot use an archived ledger as counter ledger' });
      }
    }

    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: userName, updatedByRole: role },
      { new: true, runValidators: true }
    ).populate('ledgerId', 'name type');

    await logAudit({
      req,
      entityType: 'transaction',
      entityId: String(transaction._id),
      action: 'UPDATE_TRANSACTION',
      userId: String(req.user.id || ''),
      userName,
      role,
      status: 'SUCCESS',
      description: `Updated transaction of ৳${transaction.amount} for ${transaction.ledgerId?.name || 'ledger'}`,
      before,
      after: transaction.toObject(),
    });

    emitTransactionsChanged({
      action: 'updated',
      transactionId: String(transaction._id),
    });

    // Send Discord notification (fire-and-forget, don't block response)
    sendDiscordNotification({
      action: 'UPDATE_TRANSACTION',
      transaction,
      changes: {
        before: formatHistorySnapshot(before, before),
        after: formatHistorySnapshot(transaction.toObject(), transaction),
      },
      user: { username: userName, role },
    }).catch(() => {});

    res.json(transaction);
  } catch (error) {
    res.status(400).json({ message: 'Failed to update transaction', error: error.message });
  }
});

router.delete('/:id', requireAuth, authorizeRoles('admin'), checkIfDayLocked, async (req, res) => {
  try {
    const userName = req.user.username || req.user.name;
    const role = req.user.role;

    const before = await Transaction.findById(req.params.id).populate('ledgerId', 'name type').lean();
    if (!before) return res.status(404).json({ message: 'Transaction not found' });

    const transaction = await Transaction.findByIdAndDelete(req.params.id);

    await logAudit({
      req,
      entityType: 'transaction',
      entityId: String(before._id),
      action: 'DELETE_TRANSACTION',
      userId: String(req.user.id || ''),
      userName,
      role,
      status: 'SUCCESS',
      description: `Deleted transaction of ৳${before.amount} for ${before.ledgerId?.name || 'ledger'}`,
      before,
      after: null,
    });

    emitTransactionsChanged({
      action: 'deleted',
      transactionId: String(before._id),
    });

    // Send Discord notification (fire-and-forget, don't block response)
    sendDiscordNotification({
      action: 'DELETE_TRANSACTION',
      transaction: { ...before, ledgerId: { name: before.ledgerId?.name } },
      user: { username: userName, role },
    }).catch(() => {});

    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete transaction', error: error.message });
  }
});

module.exports = router;
