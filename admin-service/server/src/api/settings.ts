import * as express from 'express';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All global settings routes have been removed as this is now handled on a per-bot basis.

export default router;
