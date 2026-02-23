import * as express from 'express';
import * as crypto from 'crypto';
import prisma from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Prisma, Role } from '@prisma/client';
import { sendInvitationEmail } from '../services/emailService.js';
import { hashPassword } from '../utils/auth.js';

// ... listMembers function remains the same ...
export const listMembers = async (req: AuthenticatedRequest, res: express.Response) => {
    const companyId = req.user!.companyId;
    try {
        const members = await prisma.user.findMany({
            where: { companyId: companyId },
            select: { id: true, email: true, role: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        });
        res.status(200).json(members);
    } catch (error) {
        console.error('Failed to list team members:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

export const inviteMember = async (req: AuthenticatedRequest, res: express.Response) => {
    const { email, role } = req.body;
    const companyId = req.user!.companyId;
    const currentUserRole = req.user!.role;

    if (!email || !role) {
        return res.status(400).json({ message: 'Email and role are required.' });
    }

    if (currentUserRole === Role.MANAGER && role === Role.MANAGER) {
        return res.status(403).json({ message: 'Managers are not allowed to invite other managers.' });
    }

    if (role !== Role.AGENT && role !== Role.MANAGER) {
        return res.status(400).json({ message: 'You can only invite AGENTs or MANAGERs.' });
    }

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ message: 'A user with this email already exists.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await prisma.invitation.create({
            data: {
                email,
                companyId,
                token,
                expiresAt,
                role,
            },
        });

        await sendInvitationEmail(email, token);

        res.status(201).json({ message: 'Invitation sent successfully.' });

    } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(409).json({ message: `An invitation has already been sent to ${email} for this company.` });
        }
        console.error('Failed to create invitation:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

export const addMember = async (req: AuthenticatedRequest, res: express.Response) => {
    const { email, role } = req.body;
    const companyId = req.user!.companyId;
    const currentUserRole = req.user!.role;

    if (!email || !role) {
        return res.status(400).json({ message: 'Email and role are required.' });
    }

    if (currentUserRole === Role.MANAGER && role === Role.MANAGER) {
        return res.status(403).json({ message: 'Managers are not allowed to add other managers.' });
    }

    if (role !== Role.AGENT && role !== Role.MANAGER) {
        return res.status(400).json({ message: 'You can only add AGENTs or MANAGERs.' });
    }

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ message: 'A user with this email already exists.' });
        }

        const passwordHash = await hashPassword('12345678');

        const newUser = await prisma.user.create({
            data: {
                email,
                passwordHash,
                companyId,
                role,
            },
        });

        res.status(201).json({
            id: newUser.id,
            email: newUser.email,
            role: newUser.role,
            createdAt: newUser.createdAt,
        });
    } catch (error) {
        console.error('Failed to add member:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

export const removeMember = async (req: AuthenticatedRequest, res: express.Response) => {
    const { userId: memberIdToRemove } = req.params;
    const currentUser = req.user!;

    if (memberIdToRemove === currentUser.userId) {
        return res.status(400).json({ message: "You cannot remove yourself." });
    }

    try {
        const where: Prisma.UserDeleteManyArgs['where'] = {
            id: memberIdToRemove,
            companyId: currentUser.companyId,
            role: {
                not: Role.OWNER
            }
        };

        if (currentUser.role === Role.MANAGER) {
            where.role = Role.AGENT;
        }

        const result = await prisma.user.deleteMany({ where });

        if (result.count === 0) {
            return res.status(404).json({ message: 'Member not found or you do not have permission to remove this user.' });
        }

        res.status(200).json({ message: 'Team member removed successfully.' });
    } catch (error) {
        console.error('Failed to remove team member:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

export const listPendingInvitations = async (req: AuthenticatedRequest, res: express.Response) => {
    const companyId = req.user!.companyId;

    try {
        const invitations = await prisma.invitation.findMany({
            where: {
                companyId: companyId,
                expiresAt: {
                    gt: new Date()
                }
            },
            select: {
                id: true,
                email: true,
                expiresAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        res.status(200).json(invitations);
    } catch (error) {
        console.error('Failed to list pending invitations:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

export const revokeInvitation = async (req: AuthenticatedRequest, res: express.Response) => {
    const { invitationId } = req.params;
    const companyId = req.user!.companyId;

    try {
        const result = await prisma.invitation.deleteMany({
            where: {
                id: invitationId,
                companyId: companyId
            }
        });

        if (result.count === 0) {
            return res.status(404).json({ message: 'Invitation not found or permission denied.' });
        }

        res.status(200).json({ message: 'Invitation revoked successfully.' });
    } catch (error) {
        console.error('Failed to revoke invitation:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

export const updateRole = async (req: AuthenticatedRequest, res: express.Response) => {
    const { userId } = req.params;
    const { role } = req.body;
    const companyId = req.user!.companyId;

    if (req.user!.userId === userId) {
        return res.status(400).json({ message: 'You cannot change your own role.' });
    }

    if (role !== Role.AGENT && role !== Role.MANAGER) {
        return res.status(400).json({ message: 'Invalid role specified.' });
    }

    try {
        const updatedUser = await prisma.user.updateMany({
            where: {
                id: userId,
                companyId: companyId,
                role: {
                    not: Role.OWNER,
                },
            },
            data: {
                role: role,
            },
        });

        if (updatedUser.count === 0) {
            return res.status(404).json({ message: 'User not found or you do not have permission to change their role.' });
        }

        res.status(200).json({ message: 'User role updated successfully.' });
    } catch (error) {
        console.error('Failed to update user role:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};