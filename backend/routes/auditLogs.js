const express = require('express');
const dayjs = require('dayjs');
const AuditLog = require('../models/AuditLog');
const { requireAuth, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, authorizeRoles('admin'));

function parseRange(query) {
  const from = query.from && dayjs(query.from).isValid() ? dayjs(query.from).startOf('day').toDate() : null;
  const to = query.to && dayjs(query.to).isValid() ? dayjs(query.to).endOf('day').toDate() : null;

  return { from, to };
}

function buildActionFilter(action) {
  const normalized = String(action || '').trim().toUpperCase();
  if (!normalized) return null;

  if (['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT', 'RESET', 'CHANGE'].includes(normalized)) {
    return new RegExp(`^${normalized}`);
  }

  return normalized;
}

function buildQuery(query) {
  const { from, to } = parseRange(query);
  const filter = {};
  const andClauses = [];

  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = from;
    if (to) filter.timestamp.$lte = to;
  }

  if (query.user) {
    const user = String(query.user).trim();
    andClauses.push({
      $or: [
        { userName: { $regex: user, $options: 'i' } },
        { actor: { $regex: user, $options: 'i' } },
        { userId: { $regex: user, $options: 'i' } },
      ],
    });
  }

  if (query.entityType) {
    filter.entityType = String(query.entityType).trim().toLowerCase();
  }

  if (query.status) {
    filter.status = String(query.status).trim().toUpperCase();
  }

  const actionFilter = buildActionFilter(query.action);
  if (actionFilter) {
    filter.action = actionFilter;
  }

  if (query.search) {
    const text = String(query.search).trim();
    andClauses.push({
      $or: [
        { description: { $regex: text, $options: 'i' } },
        { userName: { $regex: text, $options: 'i' } },
        { actor: { $regex: text, $options: 'i' } },
      ],
    });
  }

  if (andClauses.length > 0) {
    filter.$and = andClauses;
  }

  return filter;
}

router.get('/', async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const query = buildQuery(req.query);

    const [items, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load audit logs', error: error.message });
  }
});

router.get('/export.csv', async (req, res) => {
  try {
    const query = buildQuery(req.query);
    const rows = await AuditLog.find(query).sort({ timestamp: -1, _id: -1 }).limit(5000).lean();

    const header = [
      'Timestamp',
      'User',
      'Role',
      'Action',
      'Entity Type',
      'Entity Id',
      'Status',
      'Description',
      'IP Address',
      'Device Info',
    ];

    const csvEscape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const lines = [header.map(csvEscape).join(',')];

    rows.forEach((row) => {
      lines.push(
        [
          row.timestamp,
          row.userName || row.actor,
          row.role,
          row.action,
          row.entityType,
          row.entityId,
          row.status,
          row.description,
          row.ipAddress,
          row.deviceInfo,
        ]
          .map(csvEscape)
          .join(',')
      );
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${dayjs().format('YYYYMMDD-HHmmss')}.csv"`);
    res.send(lines.join('\n'));
  } catch (error) {
    res.status(500).json({ message: 'Failed to export audit logs', error: error.message });
  }
});

module.exports = router;