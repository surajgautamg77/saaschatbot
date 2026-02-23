import * as express from 'express';
import { verifyToken } from '../utils/auth.js';
import prisma from '../db.js';
import { Prisma, Role } from '@prisma/client';

// 1. Define the precise shape of our session object using Prisma's validator.
const sessionPayloadValidator = Prisma.validator<Prisma.SessionDefaultArgs>()({
    include: {
        company: true
    }
});

// Infer the TypeScript type from the validator. This is our perfect session type.
type SessionWithCompany = Prisma.SessionGetPayload<typeof sessionPayloadValidator>;

// 2. Create ONE custom request interface that covers all our needs.
export interface AuthenticatedRequest extends express.Request {
    // `user` is optional because it's only added AFTER the `protect` middleware runs.
    user?: {
        userId: string;
        companyId: string;
        role: Role;
    };
    // `session` is optional because it's only added AFTER the `verifySession` middleware runs.
    // We now use our perfectly typed `SessionWithKnowledge` instead of `any`.
    session?: SessionWithCompany;
}


// 3. The middleware functions remain the same, but now they correctly
//    populate the properties of our single, unified AuthenticatedRequest type.

export const protect = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // ... no changes to the logic inside this function ...
    const authReq = req as AuthenticatedRequest;
    let token;
    if (authReq.headers.authorization && authReq.headers.authorization.startsWith('Bearer')) {
        try {
            token = authReq.headers.authorization.split(' ')[1];
            const decoded = verifyToken(token);
            if (!decoded || !decoded.userId) { return res.status(401).json({ message: 'Not authorized, token failed' }); }
            const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true, companyId: true, role: true } });
            if (!user) { return res.status(401).json({ message: 'User not found.' }); }
            authReq.user = { userId: user.id, companyId: user.companyId, role: user.role };
            next();
        } catch (error) { return res.status(401).json({ message: 'Not authorized' }); }
    } else { return res.status(401).json({ message: 'Not authorized, no token' }); }
};

export const verifySession = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const sessionReq = req as AuthenticatedRequest;
    const { sessionId } = sessionReq.body;
    if (!sessionId) { return res.status(400).json({ message: 'Session ID is required.' }); }
    try {
        const session = await prisma.session.findUnique({
            where: { sessionId },
            include: { company: true }
        });
        if (!session) { return res.status(404).json({ message: 'Session not found or has expired.' }); }
        sessionReq.session = session;
        next();
    } catch (error) { return res.status(500).json({ message: 'Internal server error.' }); }
};

export const requireRole = (requiredRoles: Role | Role[]) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const authReq = req as AuthenticatedRequest;
        const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

        if (authReq.user && roles.includes(authReq.user.role)) {
            next();
        } else {
            res.status(403).json({ message: 'Forbidden: You do not have the required permissions.' });
        }
    };
};