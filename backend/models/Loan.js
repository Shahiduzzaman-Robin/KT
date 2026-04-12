const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema(
  {
    borrowerName: {
      type: String,
      required: true,
      trim: true,
    },
    ledgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ledger',
      default: null, // Optional: in case they want to link to an existing ledger
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    remainingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active',
      index: true,
    },
    type: {
      type: String,
      enum: ['loan', 'advance'],
      default: 'loan',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: String,
      default: 'admin',
    },
    repaymentHistory: [
      {
        amount: Number,
        date: { type: Date, default: Date.now },
        description: String,
        transactionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Transaction',
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Loan', loanSchema);
