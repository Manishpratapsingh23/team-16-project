import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import notificationRoutes from './routes/notificationRoutes.js';
import notificationTriggersRoutes from './routes/notificationTriggersRoutes.js';
import { verifyEmailService } from './utils/emailService.js';
import { setupSocketHandlers } from './utils/socketHandler.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const httpServer = createServer(app);

// Socket.IO instance (exported for use in controllers)
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bookswap';

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('✅ MongoDB connected successfully');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err);
  });

// Setup Socket.IO event handlers
setupSocketHandlers(io);

// Routes
app.use('/api/notifications', notificationRoutes);
app.use('/api/notifications/trigger', notificationTriggersRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Start server
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO running on ws://localhost:${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}\n`);

  // Verify email service
  verifyEmailService().then((verified) => {
    if (!verified) {
      console.warn(
        '⚠️  Email service not configured. Email notifications will not be sent.\n   Configure EMAIL_USER and EMAIL_PASSWORD in .env file.'
      );
    }
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n📛 Shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    mongoose.connection.close();
    process.exit(0);
  });
});

export default app;
