// Trivial change to force recompilation
import express from 'express';
import * as multer from 'multer';
import * as path from 'path';
import {
    listBots, createBot, deleteBot, getBotFlow, updateBotFlow,
    getPublicBotSettings, getBotDetails, updateBotSettings,

    uploadBotLogo, deleteBotLogo, updateBot, uploadKnowledge
} from '../controllers/bots.js';
import { protect, requireRole } from '../middleware/auth.js'; 
import * as Prisma from '@prisma/client';

const router = express.Router();

// Multer setup for bot logos
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.resolve(process.cwd(), 'uploads')),
    filename: (req, file, cb) => {
        const botId = req.params.id || 'unknown';
        cb(null, `bot-${botId}-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = (multer as any).default({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

const knowledgeStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.resolve(process.cwd(), 'uploads/temp')),
    filename: (req, file, cb) => {
        const botId = req.params.id || 'unknown';
        cb(null, `knowledge-${botId}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const uploadKnowledgeFile = (multer as any).default({ storage: knowledgeStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// existing code ...
router.get('/bots', protect, requireRole([Prisma.Role.OWNER, Prisma.Role.MANAGER]), listBots);
router.post('/bots', protect, requireRole([Prisma.Role.OWNER, Prisma.Role.MANAGER]), createBot);
router.put('/bots/:id', protect, requireRole([Prisma.Role.OWNER, Prisma.Role.MANAGER]), updateBot);
router.delete('/bots/:id', protect, requireRole([Prisma.Role.OWNER, Prisma.Role.MANAGER]), deleteBot);
router.get('/bots/:id/flow', protect, requireRole([Prisma.Role.OWNER, Prisma.Role.MANAGER]), getBotFlow);
router.put('/bots/:id/flow', protect, requireRole([Prisma.Role.OWNER, Prisma.Role.MANAGER]), updateBotFlow);
router.get('/bots/:id/details', protect, requireRole([Prisma.Role.OWNER, Prisma.Role.MANAGER]), getBotDetails);
router.put('/bots/:id/settings', protect, requireRole([Prisma.Role.OWNER, Prisma.Role.MANAGER]), updateBotSettings);
router.post('/bots/:id/logo', protect, requireRole([Prisma.Role.OWNER, Prisma.Role.MANAGER]), upload.single('logo'), uploadBotLogo);
router.delete('/bots/:id/logo', protect, requireRole([Prisma.Role.OWNER, Prisma.Role.MANAGER]), deleteBotLogo);
router.post('/bots/:id/knowledge/upload', protect, requireRole([Prisma.Role.OWNER, Prisma.Role.MANAGER]), uploadKnowledgeFile.array('files'), uploadKnowledge);

export default router;