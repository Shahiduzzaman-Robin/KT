const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    type: {
      type: String,
      enum: ['customer', 'supplier', 'employee', 'other'],
      default: 'other',
      index: true,
    },
    contact: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    totalDebit: {
      type: Number,
      default: 0,
    },
    totalCredit: {
      type: Number,
      default: 0,
    },
    closingBalanceNum: {
      type: Number,
      default: 0,
    },
    closingBalanceType: {
      type: String,
      trim: true,
      default: '',
    },
    isGroup: {
      type: Boolean,
      default: false,
      index: true,
    },
    isPosting: {
      type: Boolean,
      default: true,
      index: true,
    },
    parentLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ledger',
      default: null,
      index: true,
    },
    parentAccessCode: {
      type: Number,
      default: null,
      sparse: true,
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
      accessCode: {
        type: Number,
        default: null,
      },
      accessType: {
        type: Number,
        default: null,
      },
    },
    legacy: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

ledgerSchema.index({ name: 1 });
ledgerSchema.index({ isActive: 1, name: 1 });
ledgerSchema.index({ isGroup: 1, isPosting: 1, name: 1 });
ledgerSchema.index({ name: 'text' });
ledgerSchema.index({ 'source.accessCode': 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Ledger', ledgerSchema);
