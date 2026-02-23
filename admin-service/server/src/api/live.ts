import * as express from 'express';
import {
    resumeOrCreateLiveSession, getLiveUsers, postUserChatMessage,
    postAdminChatMessage, getChatMessages, getAdminAssistance,
    getSessionHistory, getSessionTranscript, assignChatToAgent,
    transferChatToAgent, returnChatToBot, addPrivateNote 
} from '../controllers/live.js';
// REMOVED: We no longer need 'allowMultibrandAccess'
import { protect, verifySession } from '../middleware/auth.js'; 

const router = express.Router();

// Public route - No changes needed
router.post('/live-session/resume-or-create', resumeOrCreateLiveSession);

// User-facing route - No changes needed
router.post('/live-chat', verifySession, postUserChatMessage);

// --- PROTECTED ADMIN/AGENT ROUTES ---
// All of these routes now rely on the secure `getSessionWhereClause` function.
// We have removed `allowMultibrandAccess` from all of them.

router.post('/live-chat/admin', protect, postAdminChatMessage);
router.get('/live-users', protect, getLiveUsers);
router.get('/live-chat', protect, getChatMessages);
router.post('/live-chat/admin-assist', protect, getAdminAssistance);

router.get('/history', protect, getSessionHistory);
router.get('/history/:sessionId', protect, getSessionTranscript);

router.put('/live-chat/assign', protect, assignChatToAgent);
router.put('/live-chat/transfer', protect, transferChatToAgent);
router.put('/live-chat/return-to-bot', protect, returnChatToBot);
router.post('/live-chat/notes', protect, addPrivateNote);


// We can also remove all the duplicate "/multibrand" routes, as they are now redundant.
// The main routes will handle the logic based on the user's role.

export { router as liveRouter };