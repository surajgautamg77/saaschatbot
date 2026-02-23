import * as express from 'express';
import { bookingsRouter } from './bookings.js';
import { visitorsRouter } from './visitors.js';
import { liveRouter } from './live.js';
import { authRouter } from './auth.js';
import { knowledgeRouter } from './knowledge.js';
import { companyRouter } from './company.js';
import botsRouter from './bots.js';
import { teamRouter } from './team.js'; 
import { analyticsRouter } from './analytics.js'; 
import { getPublicBotSettings } from '../controllers/bots.js';

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Explicitly define the public route here
router.get('/bots/public/:publicApiKey', getPublicBotSettings);

router.use(authRouter);
router.use(companyRouter);
router.use(botsRouter);
router.use(teamRouter); 
router.use(analyticsRouter); 
router.use(knowledgeRouter);
router.use(bookingsRouter);
router.use(liveRouter);
router.use(visitorsRouter);

export { router as apiRouter };