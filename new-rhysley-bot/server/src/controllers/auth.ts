import * as express from 'express';
import prisma from '../db.js';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { notifyAll } from '../websocket.js';

export const signup = async (req: express.Request, res: express.Response) => {
    const { email, password, companyName } = req.body;

    if (!email || !password || !companyName) {
        return res.status(400).json({ message: 'Email, password, and company name are required.' });
    }

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ message: 'User with this email already exists.' });
        }

        const passwordHash = await hashPassword(password);

        // Use a transaction to ensure both company and user are created successfully.
        const newUser = await prisma.$transaction(async (tx:any) => {
            const company = await tx.company.create({
                data: { name: companyName }
            });

            const user = await tx.user.create({
                data: {
                    email,
                    passwordHash,
                    companyId: company.id,
                    role: 'OWNER'
                }
            });
            return user;
        });

        const token = generateToken({ userId: newUser.id, companyId: newUser.companyId });

        res.status(201).json({ 
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                companyId: newUser.companyId,
                role: newUser.role
            }
        });
    } catch (error) {
        console.error("Signup Error:", error);
        res.status(500).json({ message: 'Internal server error during signup.' });
    }
};

export const login = async (req: express.Request, res: express.Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const isMatch = await comparePassword(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const token = generateToken({ userId: user.id, companyId: user.companyId });

        res.status(200).json({ 
            token,
            user: {
                id: user.id,
                email: user.email,
                companyId: user.companyId,
                role: user.role
            }
        });
    } catch (error:any) {

        console.log("##############################", error)
        console.error("Login Error:", error);
        
        res.status(500).json({ message: error.message|| 'Internal server error during login.' });
    }
};

export const logout = async (req: AuthenticatedRequest, res: express.Response) => {
    const userId = req.user?.userId;

    if (!userId) {
        return res.status(400).json({ message: 'User not found in request.' });
    }

    try {
        const assignedSessions = await prisma.session.findMany({
            where: { assignedToId: userId },
        });

        if (assignedSessions.length > 0) {
            await prisma.session.updateMany({
                where: { assignedToId: userId },
                data: {
                    assignedToId: null,
                    status: 'bot',
                    isToReassign: true,
                },
            });

            notifyAll('chat_updated', { unassignedBy: userId });
        }

        res.status(200).json({ message: 'Successfully logged out.' });
    } catch (error) {
        console.error('Logout Error:', error);
        res.status(500).json({ message: 'Internal server error during logout.' });
    }
};

export const acceptInvitation = async (req: express.Request, res: express.Response) => {
    const { token, password } = req.body;

    if (!token || !password) {
        return res.status(400).json({ message: 'Token and password are required.' });
    }

    try {
        // Find the invitation and include the company name for the welcome message
        const invitation = await prisma.invitation.findUnique({
            where: { token },
        });

        if (!invitation) {
            return res.status(401).json({ message: 'Invitation not found.' });
        }

        if (invitation.expiresAt < new Date()) {
            await prisma.invitation.delete({ where: { token } });
            return res.status(401).json({ message: 'Invitation has expired.' });
        }

        // Check if a user with this email has somehow been created since the invite was sent
        const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
        if (existingUser) {
            // Also delete the now-useless invitation
            await prisma.invitation.delete({ where: { token } });
            return res.status(409).json({ message: 'A user with this email already exists. Please log in.' });
        }
        
        const passwordHash = await hashPassword(password);

        // Use a transaction to create the user and delete the invitation atomically
        const newUser = await prisma.$transaction(async (tx:any) => {
            const user = await tx.user.create({
                data: {
                    email: invitation.email,
                    passwordHash,
                    companyId: invitation.companyId,
                    role: invitation.role,
                },
            });

            // The invitation has been used, so delete it.
            await tx.invitation.delete({ where: { token } });

            return user;
        });

        // Log the new user in immediately and send back a token
        const authToken = generateToken({ userId: newUser.id, companyId: newUser.companyId });

        res.status(201).json({
            token: authToken,
            user: {
                id: newUser.id,
                email: newUser.email,
                companyId: newUser.companyId,
                role: newUser.role,
            },
        });

    } catch (error) {
        console.error('Failed to accept invitation:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

export const changePassword = async (req: AuthenticatedRequest, res: express.Response) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user!.userId;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'Old and new passwords are required.' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const isMatch = await comparePassword(oldPassword, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid old password.' });
        }

        const passwordHash = await hashPassword(newPassword);

        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash },
        });

        res.status(200).json({ message: 'Password changed successfully.' });
    } catch (error) {
        console.error('Change Password Error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

export const disconnect = async (req: AuthenticatedRequest, res: express.Response) => {
    const userId = req.user?.userId;

    if (!userId) {
        return res.status(400).json({ message: 'User not found in request.' });
    }

    try {
        const assignedSessions = await prisma.session.findMany({
            where: { assignedToId: userId },
        });

        if (assignedSessions.length > 0) {
            await prisma.session.updateMany({
                where: { assignedToId: userId },
                data: {
                    assignedToId: null,
                    status: 'bot',
                    isToReassign: true,
                },
            });

            notifyAll('chat_updated', { unassignedBy: userId });
        }

        res.status(200).json({ message: 'Successfully disconnected.' });
    } catch (error) {
        console.error('Disconnect Error:', error);
        res.status(500).json({ message: 'Internal server error during disconnect.' });
    }
};