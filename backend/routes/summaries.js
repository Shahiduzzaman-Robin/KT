const express = require('express');
const dayjs = require('dayjs');
const Transaction = require('../models/Transaction');

const router = express.Router();

async function sumBetween(startDate, endDate) {
  const rows = await Transaction.aggregate([
    {
      $match: {
        date: {
          $gte: startDate,
          $lte: endDate,
        },
        // Exclude loan-related movements from business totals
        loanId: { $exists: false },
        description: { $not: { $regexMatch: { input: "$description", regex: /loan/i } } }
      },
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
      },
    },
  ]);

  const income = rows.find((r) => r._id === 'income')?.total || 0;
  const outgoing = rows.find((r) => r._id === 'outgoing')?.total || 0;

  return { income, outgoing, balance: income - outgoing };
}

router.get('/daily', async (req, res) => {
  try {
    const date = req.query.date ? dayjs(req.query.date) : dayjs();
    const start = date.startOf('day').toDate();
    const end = date.endOf('day').toDate();
    
    // Get transaction summary
    const summary = await sumBetween(start, end);
    
    // Get loans issued today
    const Loan = require('../models/Loan');
    const loansIssued = await Loan.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const loansIssuedToday = loansIssued[0]?.total || 0;

    res.json({ 
      date: date.format('YYYY-MM-DD'), 
      ...summary,
      loansIssuedToday 
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch daily summary', error: error.message });
  }
});

router.get('/monthly', async (req, res) => {
  try {
    const month = req.query.month ? dayjs(`${req.query.month}-01`) : dayjs().startOf('month');
    const start = month.startOf('month').toDate();
    const end = month.endOf('month').toDate();
    const summary = await sumBetween(start, end);
    res.json({ month: month.format('YYYY-MM'), ...summary });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch monthly summary', error: error.message });
  }
});

router.get('/yearly', async (req, res) => {
  try {
    const year = Number(req.query.year) || dayjs().year();
    const start = dayjs(`${year}-01-01`).startOf('year').toDate();
    const end = dayjs(`${year}-12-31`).endOf('day').toDate();
    const summary = await sumBetween(start, end);
    res.json({ year, ...summary });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch yearly summary', error: error.message });
  }
});

router.get('/category-breakdown', async (req, res) => {
  try {
    const from = req.query.from ? dayjs(req.query.from).startOf('day').toDate() : dayjs().startOf('month').toDate();
    const to = req.query.to ? dayjs(req.query.to).endOf('day').toDate() : dayjs().endOf('day').toDate();

    const rows = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: from, $lte: to },
          loanId: { $exists: false },
          description: { $not: { $regexMatch: { input: "$description", regex: /loan/i } } }
        }
      },
      {
        $lookup: {
          from: 'ledgers',
          localField: 'ledgerId',
          foreignField: '_id',
          as: 'ledger',
        },
      },
      { $unwind: '$ledger' },
      {
        $group: {
          _id: { type: '$type', ledgerType: '$ledger.type' },
          total: { $sum: '$amount' },
        },
      },
      {
        $project: {
          _id: 0,
          type: '$_id.type',
          ledgerType: '$_id.ledgerType',
          total: 1,
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch category breakdown', error: error.message });
  }
});

module.exports = router;
