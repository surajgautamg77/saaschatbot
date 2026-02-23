import * as express from 'express';
import prisma from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Prisma } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

// A helper function to construct the full URL
const getAbsoluteUrl = (path: string | null | undefined) => {
    if (!path) return null;
    const baseUrl = process.env.FRONTEND_URL;
    if (!baseUrl) {
        // Fallback for development if FRONTEND_URL is not set
        return path;
    }
    // Ensure we don't have double slashes
    return `https://${baseUrl}${path}`;
}


// --- Bot Management ---

export const listBots = async (req: AuthenticatedRequest, res: express.Response) => {
    const companyId = req.user!.companyId;
    try {
        const bots = await prisma.bot.findMany({
            where: { companyId },
            orderBy: { name: 'asc' },
            // Select fields needed for the bot list
            select: { id: true, name: true, publicApiKey: true, companyName: true }
        });
        res.status(200).json(bots);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error("Failed to list bots:", errorMessage);
        res.status(500).json({ message: 'Failed to fetch bots.' });
    }
};

export const createBot = async (req: AuthenticatedRequest, res: express.Response) => {
    const { name } = req.body;
    const companyId = req.user!.companyId;
    if (!name) {
        return res.status(400).json({ message: 'Bot name is required.' });
    }

    try {
        const newBot = await prisma.$transaction(async (tx: any) => {
            const bot = await tx.bot.create({
                data: {
                    name,
                    companyId: companyId,
                    botName: '',
                    welcomeMessage: 'Hello! How can I help you today?',
                }
            });

            // Create default nodes with bot-specific IDs
            const startNodeId = `${bot.id}-start`;
            const aiNodeId = `${bot.id}-ai-response`;
            const schedulerNodeId = `${bot.id}-scheduler`;

            await tx.node.createMany({
                data: [
                    {
                        id: startNodeId,
                        type: 'startNode',
                        position: { x: 50, y: 150 },
                        data: { label: 'Conversation Start' },
                        botId: bot.id
                    },
                    {
                        id: aiNodeId,
                        type: 'aiNode',
                        position: { x: 350, y: 50 },
                        data: { customPrompt: '' },
                        botId: bot.id
                    },
                    {
                        id: schedulerNodeId,
                        type: 'schedulerNode',
                        position: { x: 350, y: 300 },
                        data: {},
                        botId: bot.id
                    }
                ]
            });

            // Create default edge with bot-specific ID and references
            await tx.edge.create({
                data: {
                    id: `${bot.id}-edge-start-to-ai`,
                    sourceNodeId: startNodeId,
                    sourceHandle: 'start-source',
                    targetNodeId: aiNodeId,
                    botId: bot.id
                }
            });

            return bot;
        });
        res.status(201).json(newBot);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(409).json({ message: `A bot with the name ${name} already exists.`, botName: name });
        }
        res.status(500).json({ message: 'Failed to create bot.' });
    }
};

export const deleteBot = async (req: AuthenticatedRequest, res: express.Response) => {
    const { id } = req.params;
    const companyId = req.user!.companyId;
    try {
        // Prisma will ensure we only delete a bot belonging to the user's company
        await prisma.bot.delete({ where: { id, companyId } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete bot.' });
    }
};

export const updateBot = async (req: AuthenticatedRequest, res: express.Response) => {
    const { id } = req.params;
    const { name } = req.body;
    const companyId = req.user!.companyId;

    if (!name) {
        return res.status(400).json({ message: 'Bot name is required.' });
    }

    try {
        const updatedBot = await prisma.bot.update({
            where: { id, companyId },
            data: { name },
        });
        res.status(200).json(updatedBot);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(409).json({ message: `A bot with the name ${name} already exists.`, botName: name });
        }
        res.status(500).json({ message: 'Failed to update bot.' });
    }
};

// --- Bot Flow ---

export const getBotFlow = async (req: AuthenticatedRequest, res: express.Response) => {
    const { id } = req.params;
    const companyId = req.user!.companyId;
    try {
        const bot = await prisma.bot.findFirst({
            where: { id, companyId },
            include: { nodes: true, edges: true },
        });
        if (!bot) return res.status(404).json({ message: 'Bot not found.' });
        res.status(200).json(bot);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch bot flow.' });
    }
};

export const updateBotFlow = async (req: AuthenticatedRequest, res: express.Response) => {
    const { id } = req.params;
    const { nodes, edges } = req.body;
    try {
        await prisma.$transaction(async (tx: any) => {
            await tx.edge.deleteMany({ where: { botId: id } });
            await tx.node.deleteMany({ where: { botId: id } });
            await tx.node.createMany({
                data: nodes.map((node: any) => ({
                    id: node.id, botId: id, type: node.type,
                    position: node.position, data: node.data,
                })),
            });
            if (edges && edges.length > 0) {
                await tx.edge.createMany({
                    data: edges.map((edge: any) => ({
                        id: edge.id, botId: id, sourceNodeId: edge.source,
                        targetNodeId: edge.target, sourceHandle: edge.sourceHandle,
                    })),
                });
            }
        });
        res.status(200).json({ message: 'Flow updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update bot flow.' });
    }
};

// --- NEW: Bot Branding & Settings (Moved from company.ts) ---

export const getPublicBotSettings = async (req: express.Request, res: express.Response) => {
    const { publicApiKey } = req.params;
    if (!publicApiKey) return res.status(400).json({ message: 'Public API key is required.' });
    try {
        const bot = await prisma.bot.findUnique({
            where: { publicApiKey: publicApiKey },
            select: {
                botName: true, companyName: true, companyDescription: true, welcomeMessage: true, widgetColor: true, botLogoUrl: true, popupDelay: true, showUserForm: true, formFields: true, historyExpiryHours: true, chatInactivityTimeout: true,
                // Include company settings for business hours
                company: { select: { timeZone: true, businessHoursStart: true, businessHoursEnd: true } }
            }
        });
        if (!bot) return res.status(404).json({ message: 'Bot not found for the provided key.' });

        // Combine bot and company settings for the client widget
        const settings = { ...bot, ...bot.company, botLogoUrl: getAbsoluteUrl(bot.botLogoUrl) };
        res.status(200).json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch public bot settings.' });
    }
};

export const getBotDetails = async (req: AuthenticatedRequest, res: express.Response) => {
    const { id } = req.params;
    const companyId = req.user!.companyId;
    try {
        const bot = await prisma.bot.findFirst({
            where: { id, companyId },
            select: {
                id: true,
                name: true,
                publicApiKey: true,
                botName: true,
                companyName: true,
                companyDescription: true,
                welcomeMessage: true,
                systemInstruction: true,
                widgetColor: true,
                botLogoUrl: true,
                popupDelay: true,
                showUserForm: true,
                formFields: true,
                historyExpiryHours: true,
                chatInactivityTimeout: true,
            }
        });
        if (!bot) return res.status(404).json({ message: 'Bot not found.' });
        res.status(200).json({
            ...bot,
            botLogoUrl: getAbsoluteUrl(bot.botLogoUrl)
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch bot details.' });
    }
};

export const updateBotSettings = async (req: AuthenticatedRequest, res: express.Response) => {
    const { id } = req.params; // Bot ID
    const companyId = req.user!.companyId;
    const { botName, companyName, companyDescription, welcomeMessage, systemInstruction, widgetColor, popupDelay, showUserForm, formFields, historyExpiryHours, chatInactivityTimeout } = req.body;

    try {
        const updatedBot = await prisma.bot.update({
            where: { id, companyId }, // Ensures user can only update their own bot
            data: {
                botName,
                companyName,
                companyDescription,
                welcomeMessage,
                systemInstruction,
                widgetColor,
                popupDelay: Number(popupDelay),
                showUserForm: showUserForm !== undefined ? Boolean(showUserForm) : undefined,
                formFields: formFields !== undefined ? formFields : undefined,
                historyExpiryHours: historyExpiryHours !== undefined ? Number(historyExpiryHours) : undefined,
                chatInactivityTimeout: chatInactivityTimeout !== undefined ? Number(chatInactivityTimeout) : undefined,
            }
        });
        res.status(200).json(updatedBot);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update bot settings.' });
    }
};

export const uploadBotLogo = async (req: AuthenticatedRequest, res: express.Response) => {
    const { id } = req.params; // Bot ID
    const companyId = req.user!.companyId;
    const file = req.file;

    if (!file) return res.status(400).json({ message: 'No logo file uploaded.' });

    // This part is correct. We store the relative path in the DB.
    const relativeLogoUrl = `/uploads/${file.filename}`;
    try {
        await prisma.bot.update({
            where: { id, companyId },
            data: { botLogoUrl: relativeLogoUrl },
        });
        res.status(200).json({ logoUrl: getAbsoluteUrl(relativeLogoUrl) });
    } catch (error) {
        res.status(500).json({ message: 'Failed to save logo URL.' });
    }
};

export const deleteBotLogo = async (req: AuthenticatedRequest, res: express.Response) => {
    const { id } = req.params; // Bot ID
    const companyId = req.user!.companyId;
    try {
        const bot = await prisma.bot.findFirst({ where: { id, companyId }, select: { botLogoUrl: true } });
        if (bot?.botLogoUrl) {
            const filename = bot.botLogoUrl.split('/').pop();
            if (filename) fs.unlink(path.resolve(process.cwd(), 'uploads', filename), (err) => {
                if (err) console.error(`Failed to delete logo file: ${filename}`, err);
            });
        }
        await prisma.bot.update({ where: { id, companyId }, data: { botLogoUrl: null } });
        res.status(200).json({ message: 'Logo deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete logo.' });
    }
};

export const uploadKnowledge = async (req: AuthenticatedRequest, res: express.Response) => {
    const { id: botId } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded.' });
    }

    try {
        for (const file of files) {
            const formData = new FormData();
            const fileStream = fs.createReadStream(file.path);
            formData.append('file', fileStream, {
                filename: file.originalname,
                contentType: file.mimetype,
            });
            
            const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';
            const response = await axios.post(`${pythonServiceUrl}/process-pdf/`, formData, {
                headers: {
                    ...formData.getHeaders(),
                },
            });

            const { chunks } = response.data;

            const knowledgeSource = await prisma.knowledgeSource.create({
                data: {
                    botId,
                    fileName: file.originalname,
                    storagePath: file.path,
                    fileType: file.mimetype,
                },
            });

            const chunkData = chunks.map((chunk: any) => ({
                knowledgeSourceId: knowledgeSource.id,
                content: chunk.text,
                embedding: `[${chunk.embedding.join(',')}]`,
            }));

            await prisma.$executeRaw`
                INSERT INTO "KnowledgeChunk" ("id", "createdAt", "updatedAt", "knowledgeSourceId", "content", "embedding")
                VALUES ${Prisma.join(
                    chunkData.map(
                    (d) => Prisma.sql`(uuid_generate_v4(), NOW(), NOW(), ${d.knowledgeSourceId}, ${d.content}, ${d.embedding}::vector)`
                    )
                )}
            `;

            fs.unlinkSync(file.path);
        }

        res.status(200).json({ message: 'Files processed and knowledge base updated.' });
    } catch (error) {
        console.error('Error processing files:', error);
        res.status(500).json({ message: 'Failed to process files.' });
    }
};