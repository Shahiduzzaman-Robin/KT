function getClientIp(req) {
  const forwardedFor = String(req.headers?.['x-forwarded-for'] || '')
    .split(',')
    .map((value) => value.trim())
    .find(Boolean);

  return forwardedFor || req.ip || req.socket?.remoteAddress || '';
}

function getDeviceInfo(req) {
  return String(req.get?.('user-agent') || req.headers?.['user-agent'] || '').trim();
}

function attachAuditContext(req, res, next) {
  req.auditContext = {
    ipAddress: getClientIp(req),
    deviceInfo: getDeviceInfo(req),
  };

  next();
}

module.exports = {
  attachAuditContext,
  getClientIp,
  getDeviceInfo,
};