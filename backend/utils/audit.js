const AuditLog = require('../models/AuditLog');

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'currentpassword',
  'confirmpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
  'salt',
  'otp',
  'pin',
]);

const AUDIT_BATCH_SIZE = 100;
const AUDIT_FLUSH_DELAY_MS = 250;

const pendingEvents = [];
let flushTimer = null;
let flushInProgress = false;

function isPlainObject(value) {
  return Boolean(value) && Object.prototype.toString.call(value) === '[object Object]';
}

function isObjectIdLike(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (
        value._bsontype === 'ObjectId' ||
        value.constructor?.name === 'ObjectId' ||
        value.constructor?.name === 'ObjectID'
      )
  );
}

function sanitizeAuditValue(value, key = '') {
  if (value == null) return value;

  const normalizedKey = String(key || '').toLowerCase();
  if (SENSITIVE_KEYS.has(normalizedKey)) {
    return undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isObjectIdLike(value)) {
    return String(value);
  }

  if (typeof value === 'object' && Object.keys(value).length === 1 && 'buffer' in value) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeAuditValue(item))
      .filter((item) => item !== undefined);
  }

  if (isPlainObject(value)) {
    const output = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      const sanitized = sanitizeAuditValue(childValue, childKey);
      if (sanitized !== undefined) {
        output[childKey] = sanitized;
      }
    }
    return output;
  }

  if (typeof value === 'object' && typeof value.toString === 'function') {
    const stringified = value.toString();
    return stringified === '[object Object]' ? value : stringified;
  }

  return value;
}

function normalizeAction(action) {
  return String(action || 'SYSTEM').trim().toUpperCase();
}

function normalizeEntityType(entityType) {
  return String(entityType || 'system').trim().toLowerCase();
}

function getRequestContext(req = {}) {
  const forwardedFor = String(req.headers?.['x-forwarded-for'] || '')
    .split(',')
    .map((value) => value.trim())
    .find(Boolean);

  return {
    ipAddress: forwardedFor || req.ip || req.socket?.remoteAddress || '',
    deviceInfo: req.get?.('user-agent') || req.headers?.['user-agent'] || '',
  };
}

function buildAuditDocument(input = {}) {
  const context = input.req?.auditContext || getRequestContext(input.req);
  const user = input.req?.user || {};
  const actorName = String(input.userName || input.actor || user.username || user.name || 'system').trim() || 'system';

  const before = input.before !== undefined ? input.before : input.changes?.before ?? null;
  const after = input.after !== undefined ? input.after : input.changes?.after ?? input.changes ?? null;
  const metadata = input.metadata || {};

  return {
    entityType: normalizeEntityType(input.entityType),
    entityId: String(input.entityId || '').trim(),
    action: normalizeAction(input.action),
    userId: String(input.userId || user.id || '').trim(),
    userName: actorName,
    role: String(input.role || user.role || 'data-entry').trim().toLowerCase() || 'data-entry',
    status: String(input.status || 'SUCCESS').trim().toUpperCase() || 'SUCCESS',
    description: String(input.description || '').trim(),
    ipAddress: String(input.ipAddress || context.ipAddress || '').trim(),
    deviceInfo: String(input.deviceInfo || context.deviceInfo || '').trim(),
    before: sanitizeAuditValue(before),
    after: sanitizeAuditValue(after),
    metadata: sanitizeAuditValue(metadata) || {},
    actor: actorName,
    changes: sanitizeAuditValue(input.changes || {}),
    timestamp: input.timestamp ? new Date(input.timestamp) : new Date(),
  };
}

async function flushAuditQueue() {
  if (flushInProgress || pendingEvents.length === 0) {
    return;
  }

  flushInProgress = true;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const batch = pendingEvents.splice(0, AUDIT_BATCH_SIZE);

  try {
    await AuditLog.insertMany(batch, { ordered: false });
  } catch (error) {
    console.error('Failed to write audit logs:', error.message);
  } finally {
    flushInProgress = false;
    if (pendingEvents.length > 0) {
      scheduleFlush();
    }
  }
}

function scheduleFlush() {
  if (flushTimer) {
    return;
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAuditQueue();
  }, AUDIT_FLUSH_DELAY_MS);
}

function logAudit(input) {
  const auditDocument = buildAuditDocument(input);
  pendingEvents.push(auditDocument);

  if (pendingEvents.length >= AUDIT_BATCH_SIZE) {
    void flushAuditQueue();
  } else {
    scheduleFlush();
  }

  return auditDocument;
}

module.exports = {
  logAudit,
  flushAuditQueue,
  getRequestContext,
  sanitizeAuditValue,
};
