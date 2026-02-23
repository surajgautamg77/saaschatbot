import * as express from 'express';
import { getAllVisitors } from '../controllers/visitors.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/visitors', protect, getAllVisitors);

export { router as visitorsRouter };
