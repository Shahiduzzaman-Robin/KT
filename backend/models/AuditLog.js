const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ['ledger', 'transaction', 'user', 'auth', 'export', 'system', 'report'],
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      default: '',
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      default: '',
      index: true,
    },
    userName: {
      type: String,
      trim: true,
      default: 'system',
      index: true,
    },
    role: {
      type: String,
      enum: ['admin', 'data-entry', 'viewer'],
      default: 'data-entry',
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'PENDING'],
      default: 'SUCCESS',
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    ipAddress: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    deviceInfo: {
      type: String,
      trim: true,
      default: '',
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    actor: {
      type: String,
      trim: true,
      default: 'system',
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ timestamp: -1, userId: 1 });
auditLogSchema.index({ timestamp: -1, entityType: 1, action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
