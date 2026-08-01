import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { startRetryWorker } from './lib/retryWorker.js';

// Load environment variables
dotenv.config();

// Initialize database
initDb();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// __dirname for ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Global middleware
app.use(helmet({ contentSecurityPolicy: false })); // Disable CSP for inline scripts in HTML
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api', apiLimiter);

// Serve static files (frontend UIs)
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint (outside rate limiter)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

// API routes
import apiRoutes from './routes/index.js';
import statusRoutes from './routes/status.js';
app.use('/api/v1', apiRoutes);

// Public status endpoint — no auth required (#5)
app.use('/api/v1/status', statusRoutes);

// API info endpoint
app.get('/api/v1', (_req, res) => {
  res.json({
    message: 'APAR API v1',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      upload: '/api/v1/upload',
      applicants: '/api/v1/applicants',
      positions: '/api/v1/positions',
      rounds: '/api/v1/rounds',
      interviewers: '/api/v1/interviewers',
      tags: '/api/v1/tags',
      notes: '/api/v1/notes',
      messages: '/api/v1/messages',
      setup: '/api/v1/setup',
      features: '/api/v1/features',
      status: '/api/v1/status/:applicationId (public)',
    },
    frontend: {
      apply: '/apply.html',
      admin: '/admin.html',
      interviewer: '/interviewer.html',
      status: '/status.html',
    },
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`- APAR API server running on port ${PORT}`);
  console.log(`- API docs: http://localhost:${PORT}/api/v1`);
  console.log(`- Health check: http://localhost:${PORT}/health`);

  // Start background retry worker
  startRetryWorker();
});

export default app;
