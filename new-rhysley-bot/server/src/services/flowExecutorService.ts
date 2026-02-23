import prisma from '../db.js';
import { sendToSession, notifyAdmin } from '../websocket.js';
import { Role } from '../types';
import { generateAiResponse  } from './genaiService.js';

const replaceVariables = (text: string, variables: any): string => {
    if (!variables) return text;
    return text.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, variableName) => {
        return String(variables[variableName] || '');
    });
};

export const executeFlowFromNode = async (sessionId: string, botId: string, startNodeId: string) => {
    let currentNodeId: string | null = startNodeId;

    const session = await prisma.session.findUnique({ where: { sessionId } });
    if (!session) return;
    const variables = (session.variables as any) || {};

    while (currentNodeId) {
        const currentNode: any = await prisma.node.findUnique({ where: { id: currentNodeId, botId: botId } });
        if (!currentNode) {
            console.error(`Flow error: Node ${currentNodeId} not found for bot ${botId}`);
            return;
        }

        await prisma.session.update({ where: { sessionId }, data: { currentNodeId: currentNode.id } });

        let nextEdge: any | null = null;

        switch (currentNode.type) {
            case 'messageNode': {
                const text = (currentNode.data as any)?.text || '...';
                const messageText = replaceVariables(text, variables);
                const message: any = { id: crypto.randomUUID(), role: Role.MODEL, text: messageText, createdAt: new Date().toISOString() };

                sendToSession(sessionId, message);
                notifyAdmin(session.companyId, 'newMessage', { sessionId, message });

                await prisma.message.create({ data: { ...message, sessionId } });
                nextEdge = await prisma.edge.findFirst({ where: { botId, sourceNodeId: currentNode.id } });
                break;
            }

            case 'conditionNode': {
                const data = currentNode.data as any;
                const variableName = data?.variableName;
                const operator = data?.operator || 'exists';
                const variableValue = variables[variableName];

                let conditionMet = false;
                if (operator === 'exists') {
                    conditionMet = !!variableValue;
                } else if (operator === 'not_exists') {
                    conditionMet = !variableValue;
                }

                const sourceHandle = conditionMet ? 'yes' : 'no';
                nextEdge = await prisma.edge.findFirst({ where: { botId, sourceNodeId: currentNode.id, sourceHandle } });
                break;
            }

            case 'aiNode': {
                const lastUserMessage = await prisma.message.findFirst({
                    where: { sessionId, role: 'user' },
                    orderBy: { createdAt: 'desc' }
                });

                if (lastUserMessage) {
                    await generateAiResponse(sessionId, lastUserMessage.text, currentNode.data as any);
                    nextEdge = await prisma.edge.findFirst({ where: { botId, sourceNodeId: currentNode.id, sourceHandle: 'onResponse' } });
                } else {
                    // If there is no user message, we stop the flow here and wait for user input.
                    // The user's next message will be handled by postUserChatMessage.
                }

                break;
            }

            case 'choiceNode':
            case 'inputNode':
            case 'schedulerNode': {
                if (currentNode.type === 'choiceNode') {
                    const data = currentNode.data as any;
                    const questionText = replaceVariables(data.question, variables);
                    // This object is for the client and contains the choices
                    const messageForClient = { id: crypto.randomUUID(), role: Role.MODEL, text: questionText, choices: data.choices || [], createdAt: new Date().toISOString() };

                    sendToSession(sessionId, { type: 'choice_response', message: messageForClient });
                    notifyAdmin(session.companyId, 'newMessage', { sessionId, message: messageForClient });

                    // Create a new object for the database WITHOUT the 'choices' key
                    const { choices, ...messageToSave } = messageForClient;
                    await prisma.message.create({ data: { ...messageToSave, sessionId } });

                } else if (currentNode.type === 'inputNode') {
                    const data = currentNode.data as any;
                    const questionText = replaceVariables(data.question, variables);
                    const message = { id: crypto.randomUUID(), role: Role.MODEL, text: questionText };

                    sendToSession(sessionId, message);
                    notifyAdmin(session.companyId, 'newMessage', { sessionId, message });

                    await prisma.message.create({ data: { ...message, sessionId } });
                } else if (currentNode.type === 'schedulerNode') {
                    sendToSession(sessionId, { type: 'invoke_action', payload: { action: 'scheduler' } });
                }
                return;
            }

            case 'liveAgentNode': {
                await prisma.session.update({
                    where: { sessionId },
                    data: {
                        chatStatus: 'RED',
                        requiresAttention: true,
                    },
                });
                notifyAdmin(session.companyId, 'sessionUpdated', { sessionId, chatStatus: 'RED', requiresAttention: true });
                return; // Stop the flow here
            }
        }

        currentNodeId = nextEdge?.targetNodeId || null;
    }

    await prisma.session.update({ where: { sessionId }, data: { currentNodeId: null } });
};