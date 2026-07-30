import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// API routes
import apiRoutes from './routes/index.js';
app.use('/api/v1', apiRoutes);

// API info endpoint
app.get('/api/v1', (req, res) => {
  res.json({
    message: 'APAR API v1',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      upload: '/api/v1/upload',
      applicants: '/api/v1/applicants',
      positions: '/api/v1/positions',
      rounds: '/api/v1/rounds',
      interviewers: '/api/v1/interviewers',
      tags: '/api/v1/tags',
      notes: '/api/v1/notes',
      messages: '/api/v1/messages',
      setup: '/api/v1/setup'
    }
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 APAR API server running on port ${PORT}`);
  console.log(`📚 API docs: http://localhost:${PORT}/api/v1`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});

export default app;
