import * as express from 'express';
import prisma from '../db.js';
import { Role, type ChatMessage } from '../types';
import { uuidv4 } from '../utils/uuid.js';
import { sendToSession, notifyAdmin } from '../websocket.js';

import {
    generateAiResponse,
    buildAugmentedSystemInstruction,
    createChatSession,
    sendMessageToChat,
    embedQuery
} from '../services/genaiService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { executeFlowFromNode } from '../services/flowExecutorService.js';
import { Prisma } from '@prisma/client';


const getSessionWhereClause = (req: AuthenticatedRequest, sessionId?: string): Prisma.SessionWhereInput => {
    const user = req.user!;

    // --- Base condition for ALL queries ---
    const baseConditions: Prisma.SessionWhereInput = {};
    if (sessionId) {
        baseConditions.sessionId = sessionId;
    }

    // THE CRITICAL SECURITY FIX
    // 1. Check if the user has the SUPER_ADMIN role.
    if (user.role === 'SUPER_ADMIN') {
        // 2. If they are a SUPER_ADMIN, they can see everything. Return the query without a companyId filter.
        // This preserves the "all-access" view for your internal team.
        console.log(`[Auth] SUPER_ADMIN Access Granted for user ${user.userId}`);
        return baseConditions;
    }

    // --- SECURE BY DEFAULT ---
    // 3. For ALL other users (OWNER and AGENT), we ALWAYS enforce the companyId constraint.
    // The concept of 'isMultibrandView' for regular users is removed.
    const companyScopedConditions: Prisma.SessionWhereInput = {
        ...baseConditions,
        companyId: user.companyId
    };

    // 4. Apply specific logic for AGENTs within their own company (this part was already correct).
    if (user.role === 'AGENT') {
        return {
            ...companyScopedConditions,
            OR: [
                { assignedToId: null },
                { assignedToId: user.userId },
                { isToReassign: true }
            ]
        };
    }

    // 5. For OWNERs, they can see all chats within their company.
    return companyScopedConditions;
};

const getGeoFromIp = async (ip: string): Promise<string | null> => {
    if (ip === 'unknown' || ip === '::1' || ip.startsWith('127.0.0.1') || ip.startsWith('172.')) return 'Local/Internal';
    try {
        const response = await fetch(`https://ipapi.co/${ip}/json/`);
        if (!response.ok) return null;
        const data = await response.json();
        if (data.error) return null;
        return `${data.city || 'Unknown City'}, ${data.country_code || 'Unknown Country'}`;
    } catch (error) {
        console.error("[GeoIP] Lookup failed:", error);
        return null;
    }
};

export const resumeOrCreateLiveSession = async (req: express.Request, res: express.Response) => {

    // CHANGED: The API key now belongs to a bot.
    const { publicApiKey, sessionId: existingSessionId, userInfo } = req.body;
    if (!publicApiKey) return res.status(400).json({ error: 'publicApiKey is required' });

    const ip = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    try {
        // CHANGED: Find the Bot by its publicApiKey, and include its parent Company.
        const bot = await prisma.bot.findUnique({
            where: { publicApiKey },
            include: { company: true }
        });

        // If no bot is found, we cannot proceed.
        if (!bot) {
            return res.status(404).json({ message: 'Chatbot not configured for this key.' });
        }

        // The company is now derived from the bot.
        const company = bot.company;

        if (existingSessionId) {
            // Ensure the existing session belongs to the correct company.
            const existingSession = await prisma.session.findFirst({
                where: { sessionId: existingSessionId, companyId: company.id },
                include: { messages: { orderBy: { createdAt: 'asc' } } }
            });
            if (existingSession) return res.status(200).json({ sessionId: existingSession.sessionId, messages: existingSession.messages });
        }

        // If an email is provided, try to resume an existing session for that visitor
        // but only within the current bot/company context
        if (userInfo?.email) {
            const existingVisitor = await prisma.visitor.findFirst({
                where: {
                    email: userInfo.email,
                    session: {
                        companyId: company.id,
                        botId: bot.id,
                    },
                },
                include: {
                    session: {
                        include: { messages: { orderBy: { createdAt: 'asc' } } }
                    }
                }
            });

            if (existingVisitor?.session) {
                return res.status(200).json({
                    sessionId: existingVisitor.session.sessionId,
                    messages: existingVisitor.session.messages
                });
            }
        }

        // Find the start node for THIS specific bot.
        const startNode = await prisma.node.findFirst({
            where: { botId: bot.id, type: 'startNode' }
        });

        if (!startNode) {
            // THIS IS THE ORIGINAL LINE 124 in the full file. The error was likely right after this.
            return res.status(404).json({ message: 'Active bot is missing a start node.' });
        }

        const newSessionId = uuidv4();

        const [_, newSession] = await prisma.$transaction([
            prisma.company.update({ where: { id: company.id }, data: { sessionCounter: { increment: 1 } } }),
            prisma.session.create({
                data: {
                    sessionId: newSessionId,
                    ip,
                    status: 'bot',
                    chatStatus: 'GREEN',
                    lastSeen: Date.now(),
                    lastMessage: "Session started.",
                    userAgent,
                    location: await getGeoFromIp(ip),
                    // CHANGED: Set both companyId and the new botId
                    companyId: company.id,
                    botId: bot.id,
                    currentNodeId: startNode.id,
                    isOnline: false,
                    sessionNumber: company.sessionCounter + 1,
                }
            }),
        ]);
        console.log(`[Session] Created new session #${newSession.sessionNumber} for Bot ${bot.name}: ${newSessionId}`);

        // Save visitor information to Visitor table if provided
        // At this point, we know there is no existing Visitor with this email (handled above)
        if (userInfo?.name || userInfo?.email || userInfo?.mobile) {
            await prisma.visitor.create({
                data: {
                    name: userInfo?.name || null,
                    email: userInfo?.email || null,
                    phone: userInfo?.mobile || null,
                    sessionId: newSessionId,
                }
            });
        }

        // This part remains the same, but it will now use the bot's welcome message via the flow
        await executeFlowFromNode(newSession.sessionId, bot.id, startNode.id);

        const finalSession = await prisma.session.findUnique({
            where: { sessionId: newSessionId },
            include: { messages: { orderBy: { createdAt: 'asc' } } }
        });

        return res.status(200).json({ sessionId: finalSession!.sessionId, messages: finalSession!.messages });
    } catch (err) {
        console.error('Error in resumeOrCreateLiveSession:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const postUserChatMessage = async (req: AuthenticatedRequest, res: express.Response) => {

    const session = req.session!;
    const { message } = req.body as { message: ChatMessage };
    let flowHandled = false;

    try {
        if (!message.text.startsWith('__BOOKING_')) {
            await prisma.message.create({ data: { id: message.id, sessionId: session.sessionId, role: message.role, text: message.text } });
        }

        let contactInfoDetected = false;
        // If chatStatus is GREEN, check for contact info
        if (session.chatStatus === 'GREEN') {
            const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
            // US-style phone: (123) 456-7890, +1-123-456-7890, etc.
            const phoneRegexUS = /\b(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})(?: *x(\d+))?\b/;
            // Indian mobile: 10 digits starting with 6-9, optionally prefixed with +91/91/0
            const phoneRegexIN = /(?:\+?91[-\s]?|0)?[6-9]\d{9}\b/;

            if (emailRegex.test(message.text) || phoneRegexUS.test(message.text) || phoneRegexIN.test(message.text)) {
                contactInfoDetected = true;
                await prisma.session.update({
                    where: { sessionId: session.sessionId },
                    data: {
                        chatStatus: 'YELLOW',
                    },
                });
                notifyAdmin(session.companyId, 'sessionUpdated', { sessionId: session.sessionId, chatStatus: 'YELLOW' });
            }
        }

        await prisma.session.update({ where: { sessionId: session.sessionId }, data: { lastMessage: message.text, lastSeen: Date.now(), lastMessageAt: new Date() } });
        notifyAdmin(session.companyId, 'newMessage', { sessionId: session.sessionId, message });

        if (contactInfoDetected) {
            // Hardcode the response and skip the AI call to avoid safety guard issues
            const confirmationMessage = {
                id: uuidv4(),
                role: Role.MODEL,
                text: "Thank you! We've received your details, and a representative will be in touch with you shortly."
            };
            sendToSession(session.sessionId, confirmationMessage);
            await prisma.message.create({ data: { ...confirmationMessage, sessionId: session.sessionId } });
            notifyAdmin(session.companyId, 'newMessage', { sessionId: session.sessionId, message: confirmationMessage });

            // --- Forward contact info to the Python backend so it persists in Redis ---
            // Extract phone and email from the user's message
            const emailMatch = message.text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
            const phoneMatchIN = message.text.match(/(?:\+?91[-\s]?|0)?([6-9]\d{9})/);
            const phoneMatchUS = message.text.match(/(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})/);
            const extractedPhone = phoneMatchIN ? phoneMatchIN[1] || phoneMatchIN[0] : (phoneMatchUS ? phoneMatchUS[0].replace(/\D/g, '') : null);
            const extractedEmail = emailMatch ? emailMatch[0] : null;

            if (extractedPhone || extractedEmail) {
                try {
                    // Also look up visitor info from the form
                    const visitor = await prisma.visitor.findFirst({ where: { sessionId: session.sessionId } });
                    const userDetailsPayload: any = {};
                    if (visitor?.name) userDetailsPayload.name = visitor.name;
                    if (extractedEmail || visitor?.email) userDetailsPayload.email = extractedEmail || visitor.email;
                    if (extractedPhone || visitor?.phone) userDetailsPayload.phone_number = extractedPhone || visitor.phone;

                    const thirdPartyUrl = process.env.THIRD_PARTY_SERVICE_BASE_URL;
                    if (thirdPartyUrl) {
                        // Fire-and-forget: tell the Python backend about the contact details
                        fetch(`${thirdPartyUrl}/generate-ai-response`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                            body: JSON.stringify({
                                bot_id: session.botId,
                                session_id: session.sessionId,
                                user_query: message.text,
                                tenant_name: null,
                                tenant_description: null,
                                ai_node_data: {},
                                user_details: userDetailsPayload,
                            })
                        }).catch(err => console.error('[Contact Forward] Failed to notify Python backend:', err));
                    }
                } catch (err) {
                    console.error('[Contact Forward] Error extracting/forwarding contact info:', err);
                }
            }

            // End the request here since we've handled it
            return res.status(200).json({ success: true });
        }

        if (session.status === 'admin') {
            if (session.assignedToId) {
                await prisma.user.update({
                    where: { id: session.assignedToId },
                    data: { lastActivity: new Date() }
                });
            }
            return res.status(200).json({ success: true });
        }

        if (session.currentNodeId) {
            // CHANGED: session.botId is now the source of truth for the active bot.
            const botId = session.botId;
            const currentNode = await prisma.node.findUnique({ where: { id: session.currentNodeId } });

            if (currentNode?.type === 'schedulerNode') {
                let handleId: string | null = null;
                if (message.text === '__BOOKING_CONFIRMED__') handleId = 'onConfirm';
                else if (message.text === '__BOOKING_CANCELLED__') handleId = 'onCancel';

                if (handleId) {
                    const nextEdge = await prisma.edge.findFirst({ where: { botId, sourceNodeId: currentNode.id, sourceHandle: handleId } });
                    if (nextEdge) {
                        await executeFlowFromNode(session.sessionId, botId, nextEdge.targetNodeId);
                    } else {
                        await prisma.session.update({ where: { sessionId: session.sessionId }, data: { currentNodeId: null } });
                    }
                    flowHandled = true;
                }
            }
        }

        if (!flowHandled) {
            const { action } = await generateAiResponse(session.sessionId, message.text);

            if (action) {
                if (action === 'agent_request') {
                    await prisma.session.update({ where: { sessionId: session.sessionId }, data: { chatStatus: 'RED', requiresAttention: true } });
                    const responseMessage = { id: uuidv4(), role: Role.MODEL, text: "One moment, I'm finding an available agent to help you." };
                    sendToSession(session.sessionId, responseMessage);
                    await prisma.message.create({ data: { ...responseMessage, sessionId: session.sessionId } });
                    notifyAdmin(session.companyId, 'newMessage', { sessionId: session.sessionId, message: responseMessage });
                    notifyAdmin(session.companyId, 'sessionUpdated', { sessionId: session.sessionId, chatStatus: 'RED', requiresAttention: true });
                } else if (action === 'scheduler') {

                    const schedulerNode = await prisma.node.findFirst({
                        where: { botId: session.botId, type: 'schedulerNode' }
                    });

                    if (schedulerNode) {
                        await prisma.session.update({ where: { sessionId: session.sessionId }, data: { currentNodeId: schedulerNode.id } });
                        sendToSession(session.sessionId, { type: 'invoke_action', payload: { action: 'scheduler' } });
                    } else {
                        const fallbackMessage = { id: uuidv4(), role: Role.MODEL, text: "It looks like you want to schedule a demo, but the booking system isn't configured in my flow. I'll alert an agent to help you." };
                        sendToSession(session.sessionId, fallbackMessage);
                        await prisma.message.create({ data: { ...fallbackMessage, sessionId: session.sessionId } });
                        await prisma.session.update({ where: { sessionId: session.sessionId }, data: { requiresAttention: true } });
                        notifyAdmin(session.companyId, 'userUpdate', {});
                    }
                }
            }
        }

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error('Error in postUserChatMessage:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getAdminAssistance = async (req: AuthenticatedRequest, res: express.Response) => {

    const { sessionId } = req.body as { sessionId: string };

    try {
        const session = await prisma.session.findUnique({
            where: { sessionId },
            select: { botId: true }
        });
        if (!session || !session.botId) {
            return res.status(404).json({ message: "Session or associated bot not found." });
        }

        const bot = await prisma.bot.findUnique({
            where: { id: session.botId },
            select: { systemInstruction: true }
        });
        if (!bot) {
            return res.status(404).json({ message: "Bot configuration not found." });
        }

        const recentMessages = await prisma.message.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' }, take: 20 });
        const lastUserMessage = [...recentMessages].reverse().find(m => m.role === Role.USER);
        if (!lastUserMessage) {
            return res.status(400).json({ message: "No recent user message to reply to." });
        }

        const queryEmbedding = await embedQuery(lastUserMessage.text);

        // 1. Format the embedding array into a string that looks like '[0.1, 0.2, ...]'
        const vectorQueryString = `[${queryEmbedding.join(',')}]`;

        // 2. Use the string in the raw query and explicitly cast it to the ::vector type.
        const relevantChunks = await prisma.$queryRaw<Array<{ content: string }>>`
            SELECT T1.content FROM "KnowledgeChunk" AS T1
            INNER JOIN "KnowledgeSource" AS T2 ON T1."knowledgeSourceId" = T2.id
            WHERE T2."botId" = ${session.botId}
            ORDER BY T1.embedding <=> ${vectorQueryString}::vector
            LIMIT 3;
        `;

        const knowledgeBase = relevantChunks.map(chunk => chunk.content).join('\n\n---\n\n');

        let historyForAI = recentMessages.map(msg => ({
            role: msg.role === Role.USER ? 'user' : 'model',
            parts: [{ text: msg.role === Role.ADMIN ? `(Admin): ${msg.text}` : msg.text }]
        }));
        if (historyForAI.length > 0 && historyForAI[0].role === 'model') {
            historyForAI = historyForAI.slice(1);
        }

        const customInstruction = bot.systemInstruction;
        const systemInstruction = buildAugmentedSystemInstruction(knowledgeBase, customInstruction);
        // Assuming createChatSession and sendMessageToChat are from openaiService and are correct
        const messages = createChatSession(systemInstruction as any, historyForAI);
        const fullResponse = await sendMessageToChat(messages as any, "Please provide the next response for the Admin.");

        return res.status(200).json({ suggestion: fullResponse });
    } catch (err) {
        console.error('Error in getAdminAssistance:', err);
        const message = err instanceof Error ? err.message : 'An unknown error occurred.';
        return res.status(500).json({ message: `AI suggestion failed: ${message}` });
    }
};

export const getLiveUsers = async (req: AuthenticatedRequest, res: express.Response) => {

    const INACTIVITY_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
    const activeSince = new Date(Date.now() - INACTIVITY_THRESHOLD_MS);

    const whereClause: any = {
        isOnline: true,
        lastSeen: { gte: BigInt(activeSince.getTime()) },
    };
    if (req.user!.role !== 'SUPER_ADMIN') {
        whereClause.companyId = req.user!.companyId;
    }

    try {
        const usersFromDb = await prisma.session.findMany({
            where: whereClause,
            orderBy: [
                { requiresAttention: 'desc' },
                { lastMessageAt: 'desc' },
            ],
            select: {
                sessionId: true,
                status: true,
                chatStatus: true,
                lastSeen: true,
                lastMessage: true,
                ip: true,
                userAgent: true,
                location: true,
                sessionNumber: true,
                requiresAttention: true,
                isToReassign: true,
                assignedTo: { select: { id: true, email: true } },
                company: { select: { id: true, name: true } },
                // We now include the bot's name in the query result.
                bot: { select: { name: true } },
                visitor: { select: { name: true, email: true, phone: true, createdAt: true } },
                isOnline: true,
            }
        });

        const serializableUsers = usersFromDb
            .map(user => ({ ...user, lastSeen: user.lastSeen.toString() }));

        return res.status(200).json(serializableUsers);
    } catch (err) {
        console.error('Error fetching live users:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const postAdminChatMessage = async (req: AuthenticatedRequest, res: express.Response) => {

    const { sessionId, message } = req.body as { sessionId: string; message: ChatMessage };
    const agent = req.user!;

    try {
        await prisma.user.update({ where: { id: agent.userId }, data: { lastActivity: new Date() } });
        const whereClause = getSessionWhereClause(req, sessionId);
        const session = await prisma.session.findFirst({ where: whereClause });

        if (!session) {
            return res.status(404).json({ message: 'Session not found or permission denied.' });
        }

        let wasAssignedOnThisAction = false;
        if (session.status === 'bot' || !session.assignedToId) {
            const agentDetails = await prisma.user.findUnique({ where: { id: agent.userId }, select: { id: true, email: true } });
            await prisma.session.update({
                where: { sessionId },
                data: {
                    status: 'admin',
                    assignedToId: agent.userId,
                    requiresAttention: false,
                    chatStatus: 'NONE',
                    lastMessageAt: new Date(),
                    isToReassign: false,
                    wasEverAssignedToAdmin: true,
                    lastAssignedTo: {
                        id: agentDetails!.id,
                        email: agentDetails!.email
                    }
                }
            });
            wasAssignedOnThisAction = true;
        }

        await prisma.message.create({
            data: { id: message.id, sessionId, role: Role.ADMIN, text: message.text }
        });

        await prisma.session.update({
            where: { sessionId },
            data: { lastMessage: message.text, lastSeen: Date.now(), lastMessageAt: new Date() }
        });

        if (wasAssignedOnThisAction) {
            const agentDetails = await prisma.user.findUnique({ where: { id: agent.userId }, select: { id: true, email: true } });
            sendToSession(sessionId, { type: 'statusUpdate', status: 'admin' });
            notifyAdmin(session.companyId, 'sessionAssigned', {
                sessionId: session.sessionId,
                agent: { id: agent.userId, email: agentDetails!.email }
            });
        }

        sendToSession(sessionId, message);
        notifyAdmin(session.companyId, 'newMessage', { sessionId, message });

        return res.status(201).json({ success: true });
    } catch (err) {
        console.error(`[postAdminChatMessage] Error sending message for session ${sessionId}:`, err);
        return res.status(500).json({ error: 'Internal Server Error', details: err instanceof Error ? err.message : String(err) });
    }
};
export const getChatMessages = async (req: AuthenticatedRequest, res: express.Response) => {

    const { sessionId } = req.query as { sessionId: string; };

    try {
        const whereClause = getSessionWhereClause(req, sessionId);
        const session = await prisma.session.findFirstOrThrow({
            where: whereClause,
            include: {
                messages: { orderBy: { createdAt: 'asc' } },
                company: { select: { id: true, name: true } },
                bot: { select: { welcomeMessage: true } }
            }
        });

        let formattedMessages = session.messages.map(row => ({ ...row, createdAt: row.createdAt.toISOString() }));

        // CHANGED: Use the welcome message from the bot, not the company.
        if (session.bot.welcomeMessage && formattedMessages.every(m => m.text !== session.bot.welcomeMessage)) {
            const welcomeMessageObject = {
                id: 'initial-welcome-message', sessionId: sessionId, role: Role.MODEL,
                text: session.bot.welcomeMessage, createdAt: new Date(0).toISOString()
            };
            formattedMessages.unshift(welcomeMessageObject);
        }

        return res.status(200).json({
            messages: formattedMessages,
            status: session.status,
            privateNotes: session.privateNotes || [],
            company: { id: session.company.id, name: session.company.name }
        });
    } catch (err) {
        console.error('Error getting chat messages:', err);
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            return res.status(404).json({ error: 'Session not found or permission denied.' });
        }
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getSessionHistory = async (req: AuthenticatedRequest, res: express.Response) => {

    try {
        const whereClause = getSessionWhereClause(req);
        const sessions = await prisma.session.findMany({
            where: whereClause,
            orderBy: { lastSeen: 'desc' },
            select: {
                sessionId: true,
                lastMessage: true,
                lastSeen: true,
                location: true,
                status: true,
                sessionNumber: true,
                company: { select: { id: true, name: true } },
                bot: { select: { name: true } },
                assignedTo: { select: { id: true, email: true } },
                lastAssignedTo: true
            }
        });
        const serializableSessions = sessions.map(s => ({ ...s, lastSeen: s.lastSeen.toString() }));
        res.status(200).json(serializableSessions);
    } catch (err) {
        console.error('Error fetching session history:', err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getSessionTranscript = async (req: AuthenticatedRequest, res: express.Response) => {

    const { sessionId } = req.params;
    try {
        const whereClause = getSessionWhereClause(req, sessionId);
        const session = await prisma.session.findFirst({
            where: whereClause,
            include: {
                messages: { orderBy: { createdAt: 'asc' } },
                company: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, email: true } }
            }
        });
        if (!session) {
            return res.status(404).json({ message: 'Session not found or you do not have permission to view it.' });
        }
        const formattedSession = {
            ...session,
            lastSeen: session.lastSeen.toString(),
            messages: session.messages.map(m => ({ ...m, createdAt: m.createdAt.toISOString() }))
        };
        return res.status(200).json(formattedSession);
    } catch (err) {
        console.error('Error getting session transcript:', err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const assignChatToAgent = async (req: AuthenticatedRequest, res: express.Response) => {

    const { sessionId, agentId } = req.body;
    const requestingUser = req.user!;
    const targetAgentId = agentId || requestingUser.userId;

    if (!sessionId) {
        return res.status(400).json({ message: 'Session ID is required.' });
    }

    try {
        const whereClause = getSessionWhereClause(req, sessionId);

        const sessionToAssign = await prisma.session.findFirst({ where: whereClause });

        if (!sessionToAssign) {
            return res.status(409).json({ message: 'This chat has already been taken or you do not have permission to assign it.' });
        }

        const agentDetails = await prisma.user.findUnique({ where: { id: targetAgentId }, select: { id: true, email: true, role: true } });
        if (!agentDetails) throw new Error("Agent not found after assignment");

        const updatedSession = await prisma.session.update({
            where: { sessionId: sessionToAssign.sessionId },
            data: {
                status: 'admin',
                assignedToId: targetAgentId,
                requiresAttention: false,
                lastMessageAt: new Date(),
                isToReassign: false,
                wasEverAssignedToAdmin: true,
                lastAssignedTo: {
                    id: agentDetails.id,
                    email: agentDetails.email
                }
            }
        });

        await prisma.user.update({ where: { id: targetAgentId }, data: { lastActivity: new Date() } });

        sendToSession(sessionId, { type: 'statusUpdate', status: 'admin' });
        notifyAdmin(updatedSession.companyId, 'sessionAssigned', {
            sessionId: updatedSession.sessionId,
            agent: { id: agentDetails.id, email: agentDetails.email }
        });

        res.status(200).json({ message: 'Session assigned successfully.' });
    } catch (error) {
        console.error(`[assignChatToAgent] Failed to assign chat for session ${sessionId}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return res.status(409).json({ message: 'This chat has already been taken by another agent.' });
        }
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// for Transfer
export const transferChatToAgent = async (req: AuthenticatedRequest, res: express.Response) => {

    const { sessionId, targetAgentId } = req.body;

    if (!sessionId || !targetAgentId) {
        return res.status(400).json({ message: 'Session ID and Target Agent ID are required.' });
    }

    try {
        const whereClause = getSessionWhereClause(req, sessionId);
        const sessionToTransfer = await prisma.session.findFirst({ where: whereClause });

        if (!sessionToTransfer) {
            return res.status(404).json({ message: 'Session not found or permission denied.' });
        }

        const targetAgent = await prisma.user.findUnique({ where: { id: targetAgentId } });

        if (!targetAgent) {
            return res.status(404).json({ message: 'Target agent not found.' });
        }

        const updatedSession = await prisma.session.update({
            where: { sessionId: sessionToTransfer.sessionId },
            data: {
                assignedToId: targetAgentId,
                isToReassign: false,
                lastMessageAt: new Date(),
                lastAssignedTo: {
                    id: targetAgent.id,
                    email: targetAgent.email
                }
            }
        });

        await prisma.user.update({ where: { id: targetAgentId }, data: { lastActivity: new Date() } });

        // Notify all admins that the assignment has changed
        notifyAdmin(updatedSession.companyId, 'sessionAssigned', {
            sessionId: updatedSession.sessionId,
            agent: { id: targetAgent.id, email: targetAgent.email }
        });

        res.status(200).json({ message: 'Session transferred successfully.' });
    } catch (error) {
        console.error('Failed to transfer chat:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

export const returnChatToBot = async (req: AuthenticatedRequest, res: express.Response) => {

    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ message: 'Session ID is required.' });
    }

    try {
        console.log(`[returnChatToBot] Attempting to return session ${sessionId} to bot.`);
        const whereClause = getSessionWhereClause(req, sessionId);
        const sessionToUpdate = await prisma.session.findFirst({ where: whereClause });

        if (!sessionToUpdate) {
            console.error(`[returnChatToBot] Session ${sessionId} not found or permission denied for user ${req.user!.userId}.`);
            return res.status(404).json({ message: 'Session not found or permission denied.' });
        }

        const updatedSession = await prisma.session.update({
            where: { sessionId: sessionToUpdate.sessionId },
            data: {
                status: 'bot',
                assignedToId: null,
                chatStatus: 'GREEN',
                lastMessageAt: new Date()
            }
        });
        console.log(`[returnChatToBot] Session ${sessionId} successfully returned to bot. Updated session:`, updatedSession);

        notifyAdmin(updatedSession.companyId, 'sessionUpdated', {
            sessionId: updatedSession.sessionId,
            status: 'bot',
            assignedTo: null,
            chatStatus: 'GREEN'
        });
        console.log(`[returnChatToBot] Notified admins about session ${sessionId} status update.`);
        sendToSession(updatedSession.sessionId, { type: 'statusUpdate', status: 'bot' });

        res.status(200).json({ message: 'Session returned to bot successfully.' });
    } catch (error) {
        console.error(`[returnChatToBot] Failed to return chat to bot for session ${sessionId}:`, error);
        res.status(500).json({ message: 'Internal server error.', details: error instanceof Error ? error.message : String(error) });
    }
};

export const addPrivateNote = async (req: AuthenticatedRequest, res: express.Response) => {

    const { sessionId, text } = req.body;
    const agent = req.user!;

    if (!sessionId || !text) {
        return res.status(400).json({ message: 'Session ID and note text are required.' });
    }

    try {
        await prisma.user.update({ where: { id: agent.userId }, data: { lastActivity: new Date() } });
        const whereClause = getSessionWhereClause(req, sessionId);
        const session = await prisma.session.findFirst({
            where: whereClause,
            select: { privateNotes: true, companyId: true }
        });

        if (!session) {
            return res.status(404).json({ message: 'Session not found or permission denied.' });
        }

        const currentNotes = (session.privateNotes as Prisma.JsonArray) || [];
        const newNote = {
            agentId: agent.userId,
            agentEmail: (await prisma.user.findUnique({ where: { id: agent.userId } }))?.email || 'Unknown',
            text: text,
            timestamp: new Date().toISOString()
        };

        const updatedNotes = [...currentNotes, newNote];

        await prisma.session.update({
            where: { sessionId },
            data: { privateNotes: updatedNotes, lastMessageAt: new Date() }
        });

        notifyAdmin(session.companyId, 'privateNoteAdded', { sessionId, note: newNote });

        res.status(201).json(newNote);
    } catch (error) {
        console.error('Failed to add private note:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};