import * as express from 'express';
// We are REMOVING getOnlineMembers, as it's no longer needed.
import { listMembers, inviteMember, removeMember, listPendingInvitations, addMember, revokeInvitation, updateRole } from '../controllers/team.js';
import { protect, requireRole } from '../middleware/auth.js';
import * as Prisma from '@prisma/client';

const router = express.Router();

router.get('/team', protect, listMembers); // Changed to allow all members to get the list
router.post('/team/invite', protect, requireRole([Prisma.Role.OWNER, Prisma.Role.MANAGER]), inviteMember);
router.post('/team/add-member', protect, requireRole([Prisma.Role.OWNER, Prisma.Role.MANAGER]), addMember);
router.delete('/team/:userId', protect, requireRole([Prisma.Role.OWNER, Prisma.Role.MANAGER]), removeMember);
router.get('/team/invitations', protect, requireRole([Prisma.Role.OWNER, Prisma.Role.MANAGER]), listPendingInvitations);
router.delete('/team/invitations/:invitationId', protect, requireRole([Prisma.Role.OWNER, Prisma.Role.MANAGER]), revokeInvitation);
router.put('/team/:userId/role', protect, requireRole(Prisma.Role.OWNER), updateRole);

// The /team/online route has been deleted.

export { router as teamRouter };