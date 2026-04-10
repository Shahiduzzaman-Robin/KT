const jwt = require('jsonwebtoken');
const ALLOWED_ROLES = ['admin', 'data-entry', 'viewer'];
const JWT_SECRET = process.env.JWT_SECRET || 'kamrul-traders-dev-secret';

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function requireAuth(req, res, next) {
  const authorization = String(req.header('authorization') || '').trim();

  if (authorization.toLowerCase().startsWith('bearer ')) {
    const token = authorization.slice(7).trim();

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const role = normalizeRole(payload.role);

      if (!payload.sub || !payload.username || !role || !ALLOWED_ROLES.includes(role)) {
        return res.status(401).json({ message: 'Invalid session' });
      }

      req.user = {
        id: payload.sub,
        name: payload.displayName || payload.username,
        username: payload.username,
        displayName: payload.displayName || payload.username,
        role,
      };
      return next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }
  }

  const userName = String(req.header('x-user-name') || '').trim();
  const role = normalizeRole(req.header('x-user-role'));

  if (!userName) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (!role || !ALLOWED_ROLES.includes(role)) {
    return res.status(401).json({ message: 'Invalid user role' });
  }

  req.user = { id: '', name: userName, username: userName, displayName: userName, role };
  next();
}

function authorizeRoles(...allowedRoles) {
  const normalizedAllowedRoles = allowedRoles.map(normalizeRole);

  return (req, res, next) => {
    const role = req.user?.role || normalizeRole(req.header('x-user-role'));

    if (!normalizedAllowedRoles.includes(role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  authorizeRoles,
};