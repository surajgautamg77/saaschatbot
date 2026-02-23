import * as express from 'express';
// Add acceptInvitation to the import
import { signup, login, logout, acceptInvitation, changePassword, disconnect } from '../controllers/auth.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/auth/signup', signup);
router.post('/auth/login', login);
router.post('/auth/logout', protect, logout);
router.post('/auth/accept-invitation', acceptInvitation);
router.post('/auth/change-password', protect, changePassword);
router.post('/auth/disconnect', protect, disconnect);

export { router as authRouter };