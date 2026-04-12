const express = require('express');
const Loan = require('../models/Loan');
const Transaction = require('../models/Transaction');
const Ledger = require('../models/Ledger');
const { requireAuth } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();

// Health check ping
router.get('/ping', (req, res) => res.json({ message: 'Loan API is alive' }));

// Apply basic auth to all loan routes
router.use(requireAuth);

// Get all loans
router.get('/', async (req, res) => {
  try {
    const { status, type, from, to } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }

    const loans = await Loan.find(query).sort({ createdAt: 1 });
    res.json(loans);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch loans', error: error.message });
  }
});

// Add new loan
router.post('/', async (req, res) => {
  try {
    const { borrowerName, amount, date, type, description, ledgerId, createTransaction } = req.body;

    const numericAmount = Number(amount);
    const loan = new Loan({
      borrowerName,
      totalAmount: numericAmount,
      remainingAmount: numericAmount,
      date: date || new Date(),
      type: type || 'loan',
      description,
      ledgerId: ledgerId || null,
      createdBy: req.user?.username || 'admin',
    });

    // 2. Issuance
    try {
      await loan.save();
    } catch (error) {
      throw error;
    }
 
    res.status(201).json(loan);
  } catch (error) {
    res.status(500).json({ message: 'Failed to issue loan', error: error.message });
  }
});

// Record Repayment
router.post('/:id/repay', async (req, res) => {
  try {
    const { amount, date, description, ledgerId, createTransaction } = req.body;
    const loan = await Loan.findById(req.params.id);
 
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
 
    // Add to internal history
    loan.repaymentHistory.push({
      amount: Number(amount),
      date: date || new Date(),
      description
    });
 
    loan.remainingAmount -= Number(amount);
    if (loan.remainingAmount <= 0) {
      loan.status = 'closed';
    }

    await loan.save();
    res.json(loan);
  } catch (error) {
    res.status(400).json({ message: 'Failed to reduce loan', error: error.message });
  }
});

// Remove loan (Delete)
router.delete('/:id', async (req, res) => {
  try {
    const loanId = req.params.id;
    // 1. Delete associated transactions (Initial and Repayments)
    await Transaction.deleteMany({ loanId: loanId });
    
    // 2. Delete the loan itself
    const loan = await Loan.findByIdAndDelete(loanId);
    
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    res.json({ message: 'Loan and all associated transactions removed' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete loan', error: error.message });
  }
});

// Summary of active loans
router.get('/summary', async (req, res) => {
  try {
    const summary = await Loan.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$type',
          totalOutstanding: { $sum: '$remainingAmount' },
          count: { $sum: 1 },
        },
      },
    ]);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch loan summary', error: error.message });
  }
});

module.exports = router;
