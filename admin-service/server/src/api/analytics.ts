import * as express from 'express';
import { getSummaryAnalytics } from '../controllers/analytics.js';
import { protect, requireRole } from '../middleware/auth.js'; 
import * as Prisma from '@prisma/client';

const router = express.Router();

// This route is protected and only accessible by company owners
router.get('/analytics/summary', protect, requireRole([Prisma.Role.OWNER, Prisma.Role.MANAGER]), getSummaryAnalytics);

export { router as analyticsRouter };