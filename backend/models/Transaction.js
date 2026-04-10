const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    ledgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ledger',
      required: true,
      index: true,
    },
    counterLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ledger',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ['income', 'outgoing'],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 300,
    },
    createdBy: {
      type: String,
      trim: true,
      default: 'system',
    },
    createdByRole: {
      type: String,
      enum: ['admin', 'data-entry', 'viewer'],
      default: 'admin',
    },
    updatedBy: {
      type: String,
      trim: true,
      default: 'system',
    },
    updatedByRole: {
      type: String,
      enum: ['admin', 'data-entry', 'viewer'],
      default: 'admin',
    },
    source: {
      system: {
        type: String,
        default: 'manual',
        index: true,
      },
      accessDb: {
        type: String,
        default: '',
      },
      accessTable: {
        type: String,
        default: '',
      },
      importKey: {
        type: String,
        default: '',
      },
      ledgerCode: {
        type: Number,
        default: null,
        index: true,
      },
      counterLedgerCode: {
        type: Number,
        default: null,
        index: true,
      },
      rowKey: {
        type: String,
        default: '',
      },
      tableRow: {
        type: Number,
        default: null,
      },
    },
    legacy: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ date: -1, type: 1 });
transactionSchema.index({ ledgerId: 1, date: -1 });
transactionSchema.index({ ledgerId: 1, type: 1, date: -1 });
transactionSchema.index({ 'source.importKey': 1 }, { sparse: true }); // Remove unique constraint
transactionSchema.pre('save', function() {
  // Convert empty string importKey to null
  if (this.source && this.source.importKey === '') {
    this.source.importKey = null;
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);
