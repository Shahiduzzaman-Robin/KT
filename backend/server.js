const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const ledgerRoutes = require('./routes/ledgers');
const transactionRoutes = require('./routes/transactions');
const summaryRoutes = require('./routes/summaries');
const exportRoutes = require('./routes/exports');
const { ensureDefaultUsers } = require('./utils/defaultUsers');
const auditRoutes = require('./routes/auditLogs');
const { attachAuditContext } = require('./middleware/auditContext');
const { setSocketServer } = require('./utils/realtime');
const Transaction = require('./models/Transaction');

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kamrul_traders';

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
});

setSocketServer(io);

io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(attachAuditContext);

app.get('/api/health', (req, res) => {
  res.json({
    message: 'Kamrul Traders API is running',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ledgers', ledgerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/audit-logs', auditRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: 'Internal server error' });
});

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Cleanup: drop old unique index on source.importKey if it exists
    try {
      await Transaction.collection.dropIndex('source.importKey_1');
      console.log('Dropped old unique index on source.importKey');
    } catch (err) {
      // Index might not exist, that's okay
    }
    
    await ensureDefaultUsers();
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect MongoDB:', error.message);
    process.exit(1);
  });
