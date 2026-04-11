const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true, // Only one report per day
      index: true,
    },
    openingBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    totalIncome: {
      type: Number,
      required: true,
      default: 0,
    },
    totalOutgoing: {
      type: Number,
      required: true,
      default: 0,
    },
    closingBalance: {
      type: Number,
      required: true,
    },
    transactionCount: {
      type: Number,
      default: 0,
    },
    generatedBy: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'locked'],
      default: 'locked',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DailyReport', dailyReportSchema);
