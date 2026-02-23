import * as express from 'express';
import prisma from '../db.js';
import { sendToSession, notifyAdmin } from '../websocket.js';
import { Role } from '../types/index.js';
import { uuidv4 } from '../utils/uuid.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const getBookings = async (req: AuthenticatedRequest, res: express.Response) => {
    const companyId = req.user!.companyId;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    try {
        const totalBookings = await prisma.booking.count({
            where: { bot: { companyId } },
        });

        const bookings = await prisma.booking.findMany({
            where: { bot: { companyId } },
            orderBy: { date: 'desc' },
            include: { bot: { select: { name: true } } },
            skip: (page - 1) * pageSize,
            take: pageSize,
        });

        res.status(200).json({
            bookings,
            totalPages: Math.ceil(totalBookings / pageSize),
        });
    } catch (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const createBooking = async (req: express.Request, res: express.Response) => {
    const { name, email, phone, details, date, sessionId } = req.body;
    if (!name || !email || !date || !phone || !sessionId) {
        return res.status(400).json({ message: 'Missing required booking details or sessionId.' });
    }

    try {
        // CHANGED: Find the session to get the botId and companyId
        const session = await prisma.session.findUnique({
            where: { sessionId },
            select: { companyId: true, botId: true }
        });

        if (!session || !session.botId) {
            return res.status(404).json({ message: 'Chat session or associated bot not found.' });
        }

        const newBooking = await prisma.booking.create({
            data: {
                name, email, phone, details,
                date: new Date(date),
                botId: session.botId // CHANGED: Connect to the Bot
            },
        });

        // The rest of the logic for notifications is unchanged
        await prisma.session.update({ where: { sessionId }, data: { chatStatus: 'YELLOW' } });
        notifyAdmin(session.companyId, 'sessionUpdated', { sessionId, chatStatus: 'YELLOW' });
        const confirmationMessage = {
            id: uuidv4(), role: Role.MODEL,
            text: `Thanks ${name}, your demo has been booked for ${new Date(date).toLocaleString()}.`
        };
        await prisma.message.create({ data: { ...confirmationMessage, sessionId } });
        sendToSession(sessionId, confirmationMessage);
        notifyAdmin(session.companyId, 'newMessage', { sessionId, message: confirmationMessage });
        return res.status(201).json(newBooking);
    } catch (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};