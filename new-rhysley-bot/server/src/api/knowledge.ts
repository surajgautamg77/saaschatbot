import * as express from 'express';
import { getKnowledgeSources, uploadKnowledgeSource, deleteKnowledgeSource } from '../controllers/knowledge.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All knowledge routes are now scoped by a botId
router.get('/bots/:botId/knowledge', protect, getKnowledgeSources);
router.post('/bots/:botId/knowledge/upload', protect, uploadKnowledgeSource);
router.delete('/knowledge/:sourceId', protect, deleteKnowledgeSource);

export { router as knowledgeRouter };