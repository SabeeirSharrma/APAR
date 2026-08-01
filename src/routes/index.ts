import { Router } from 'express';
import authRoutes from './auth.js';
import uploadRoutes from './upload.js';
import applicantRoutes from './applicants.js';
import positionRoutes from './positions.js';
import roundRoutes from './rounds.js';
import interviewerRoutes from './interviewers.js';
import tagRoutes from './tags.js';
import noteRoutes from './notes.js';
import messageRoutes from './messages.js';
import setupRoutes from './setup.js';
import featureRoutes from './features.js';

const router = Router();

// Auth routes (public + rate-limited)
router.use('/auth', authRoutes);

// Protected routes
router.use('/upload', uploadRoutes);
router.use('/applicants', applicantRoutes);
router.use('/positions', positionRoutes);
router.use('/rounds', roundRoutes);
router.use('/interviewers', interviewerRoutes);
router.use('/tags', tagRoutes);
router.use('/notes', noteRoutes);
router.use('/messages', messageRoutes);
router.use('/setup', setupRoutes);
router.use('/features', featureRoutes);

export default router;
