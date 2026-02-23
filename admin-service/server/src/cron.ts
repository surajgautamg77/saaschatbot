import * as cron from 'node-cron';
import { notifyAdmin } from './websocket.js';
import { PrismaClient, Prisma } from '@prisma/client'; // Import PrismaClient, Prisma

// Returns inactive admin sessions back to bot after a timeout
export const startSessionInactivityCheck = (prisma: PrismaClient) => {
    cron.schedule('*/10 * * * * *', async () => {
        // console.log('[Cron] Checking for inactive admin sessions...');
        try {
            // Find all sessions that are currently assigned to an admin
            const assignedSessions = await prisma.session.findMany({
                where: {
                    status: 'admin',
                    assignedToId: { not: null }
                },
                include: {
                    bot: {
                        select: {
                            chatInactivityTimeout: true
                        }
                    }
                }
            });

            if (assignedSessions.length > 0) {
                // console.log(`[Cron] Found ${assignedSessions.length} assigned sessions to check.`);
                for (const session of assignedSessions) {
                    const inactivityTimeoutSeconds = session.bot.chatInactivityTimeout ?? 300; // Default to 5 minutes if not set on bot
                    const threshold = Date.now() - inactivityTimeoutSeconds * 1000;

                    // Use lastMessageAt for inactivity check. If null, treat as Date.now() to avoid immediate timeout.
                    const lastActivityTime = session.lastMessageAt ? session.lastMessageAt.getTime() : Date.now();

                    if (lastActivityTime < threshold) {
                        console.log(`[Cron] Session ${session.sessionId} is inactive. Last message at: ${new Date(lastActivityTime).toISOString()}.`);
                        const updatedSession = await prisma.session.update({
                            where: { sessionId: session.sessionId },
                            data: {
                                status: 'bot',
                                assignedToId: null,
                                chatStatus: 'GREEN',
                                isToReassign: true,
                            },
                            select: {
                                sessionId: true, status: true, chatStatus: true, companyId: true,
                                assignedTo: { select: { id: true, email: true } },
                            }
                        });

                        notifyAdmin(updatedSession.companyId, 'sessionUpdated', {
                            sessionId: updatedSession.sessionId,
                            status: updatedSession.status,
                            assignedTo: updatedSession.assignedTo,
                            chatStatus: updatedSession.chatStatus,
                            isToReassign: true // Explicitly notify this change
                        });
                        console.log(`[Cron] Session ${session.sessionId} returned to bot queue due to inactivity.`);
                    }
                }
            } else {
                // console.log('[Cron] No assigned sessions to check.');
            }
        } catch (error:any) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
                console.error('[Cron] Skipped inactivity check – Database table not ready yet.');
            } else {
                console.error('[Cron] Error checking for inactive sessions:', error);
            }
        }
    });
};

// Deletes old chat messages while keeping Session / Visitor rows
// Currently: deletes messages for sessions whose lastMessageAt is older than 30 days
export const startOldMessageCleanup = (prisma: PrismaClient) => {
    // Run once per day at 02:00 server time
    cron.schedule('0 2 * * *', async () => {
        const DAYS_TO_KEEP = 30; // adjust if needed
        const cutoff = new Date(Date.now() - DAYS_TO_KEEP * 24 * 60 * 60 * 1000);

        try {
            const result = await prisma.message.deleteMany({
                where: {
                    session: {
                        lastMessageAt: { lt: cutoff },
                    },
                },
            });

            if (result.count > 0) {
                console.log(`[Cron] Deleted ${result.count} old messages (older than ${DAYS_TO_KEEP} days).`);
            }
        } catch (error: any) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
                console.error('[Cron] Skipped message cleanup – Database table not ready yet.');
            } else {
                console.error('[Cron] Error deleting old messages:', error);
            }
        }
    });
};
