import * as express from 'express';
import prisma from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';


export const getSummaryAnalytics = async (req: AuthenticatedRequest, res: express.Response) => {
    const companyId = req.user!.companyId;

    try {
        const sessions = await prisma.session.findMany({
            where: { companyId },
            include: {
                messages: {
                    orderBy: {
                        createdAt: 'asc',
                    },
                    select: {
                        role: true,
                    }
                }
            }
        });

        let totalUserQueries = 0;
        let botHandledQueries = 0;
        let agentHandledQueries = 0;

        for (const session of sessions) {
            const messages = session.messages;
            for (let i = 0; i < messages.length; i++) {
                if (messages[i].role === 'user') {
                    totalUserQueries++;

                    let isAgentHandled = false;
                    let isBotHandled = false;

                    // Scan the rest of the messages in the session to see who replied
                    for (let j = i + 1; j < messages.length; j++) {
                        if (messages[j].role === 'admin') {
                            isAgentHandled = true;
                            break; // Agent handling takes priority
                        }
                        if (messages[j].role === 'model') {
                            isBotHandled = true;
                        }
                    }

                    if (isAgentHandled) {
                        agentHandledQueries++;
                    } else if (isBotHandled) {
                        botHandledQueries++;
                    }
                }
            }
        }

        const response = {
            totalConversations: totalUserQueries,
            botHandledCount: botHandledQueries,
            adminHandledCount: agentHandledQueries,
        };

        res.status(200).json(response);

    } catch (error) {
        console.error('Failed to get summary analytics:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};