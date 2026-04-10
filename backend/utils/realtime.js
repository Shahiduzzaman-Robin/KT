let ioInstance = null;

function setSocketServer(io) {
  ioInstance = io;
}

function emitTransactionsChanged(payload = {}) {
  if (!ioInstance) return;

  ioInstance.emit('transactions:changed', {
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  setSocketServer,
  emitTransactionsChanged,
};