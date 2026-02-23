// This service exclusively uses the in-house GenAI service for all AI tasks.
// We are using meta-llama/Meta-Llama-3-8B-Instruct for responce and nomic-ai/nomic-embed-text-v1.5 for embedding.
// we also meta-llama/Llama-Guard-3-8B for safety checks and it is hell for me.

import prisma from '../db.js';
import { sendToSession, notifyAdmin } from '../websocket.js';
import { Role } from '../types/index.js';
import { uuidv4 } from '../utils/uuid.js';

// --- API Configuration ---
const GENAI_API_BASE_URL = 'https://aibot14.studyineurope.xyz/genaiapi';

// --- Type Definitions for Embedding ---
interface EmbeddingApiRequest {
    text: string;
    task_type?: 'search_query' | 'search_document';
}
interface EmbeddingApiResponse {
    embedding: number[];
}

// --- Type Definitions for Chat Generation ---
interface ChatGenerationApiRequest {
    prompt: string;
    max_tokens?: number;
    temperature?: number;
    top_p?:number
}

interface ChatGenerationApiResponse {
    generated_text?: string;
    error?: string;
    safety?: string;
}

/**
 * Generates an embedding for a given text using the self-hosted GenAI API.
 */
export const generateEmbedding = async (text: string, task_type: 'search_query' | 'search_document' = 'search_query'): Promise<number[]> => {
    if (!text || text.trim().length < 3) {
        // Return a zero-vector for empty input, but don't treat it as an error.
        return Array(768).fill(0);
    }

    try {
        const requestBody: EmbeddingApiRequest = { text, task_type };
        const response = await fetch(`${GENAI_API_BASE_URL}/embed/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`GenAI Embedding API error: Status ${response.status}`, errorText);
            throw new Error(`GenAI Embedding API error: ${response.status}`);
        }

        const clonedResponse = response.clone();
        const responseText = await clonedResponse.text();

        try {
            const data: EmbeddingApiResponse = await response.json();
            if (!data.embedding || !Array.isArray(data.embedding)) {
                throw new Error('Invalid embedding response format from GenAI API.');
            }
            return data.embedding;
        } catch (jsonError) {
            console.error('Error parsing JSON from GenAI Embedding API:', jsonError);
            console.error('Raw Response Text:', responseText);
            throw new Error('Invalid response from GenAI Embedding API.');
        }
    } catch (error) {
        // Re-throw the error to be handled by the caller
        throw error;
    }
};

// Alias for embedding queries
export const embedQuery = generateEmbedding;

/**
 * Generates a chat response using the self-hosted GenAI API.
 */
export const generateChatResponse = async (prompt: string, max_tokens: number = 500, temperature: number = 0.1, top_p: number = 0.9): Promise<string> => {
    // The user's GenAI API expects a `prompt`. We pass the fully formatted Llama3 prompt string here.
    const requestBody: ChatGenerationApiRequest = { prompt, max_tokens,  temperature, top_p };

    try {
        const response = await fetch(`${GENAI_API_BASE_URL}/generate/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        // If the response is not OK, or if it's not JSON, we need to handle it.
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`GenAI Chat API error: Status ${response.status}`, errorText);
            // Return a generic error message to the user
            return "I'm sorry, I am Unable to understand. you can request for human assistance.";
        }

        // Clone the response so we can inspect the body without consuming it
        const clonedResponse = response.clone();
        const responseText = await clonedResponse.text();

        // Now, safely attempt to parse the JSON
        let data: ChatGenerationApiResponse;
        try {
            data = await response.json();
        } catch (jsonError) {
            console.error('Error parsing JSON from GenAI Chat API:', jsonError);
            console.error('Raw Response Text:', responseText); // Log the problematic text
             if (responseText.toLowerCase().includes('unsafe')) {
                return "I cannot respond to that request as it violates safety policies.";
            }
            return "I'm sorry, I received an invalid response from the server.";
        }


        if (data.error) {
            const errorMessage = data.error;
            console.error(`GenAI Chat API error:`, errorMessage, `(Safety: ${data.safety || 'N/A'})`);
            if (data.safety?.includes('unsafe')) {
                return "I cannot respond to that request as it violates safety policies.";
            }
            return "I'm sorry, I am Unable to understand. you can request for human assistance.";
        }

        if (!data.generated_text) {
            console.error('Invalid chat response format from GenAI API (missing generated_text).');
            return "I'm sorry, I received an invalid response from the server.";
        }

        return data.generated_text;
    } catch (error) {
        console.error('Error calling GenAI Chat API:', error);
        return "I'm sorry, an unexpected error occurred while trying to generate a response.";
    }
};


// --- Logic copied and adapted from original openAiService.ts ---

export const buildAugmentedSystemInstruction = (knowledgeBase: string, customInstruction: string | null) => {
    const nonNegotiableRule = `
    You are a customer support assistant. Your primary directive is to answer user questions based *only* on the provided CONTEXT. Follow these rules strictly:
    1.  First, check if the user's intent matches one of the ACTION TRIGGERS below. If it does, your ONLY response MUST be the corresponding action tag (e.g., '[ACTION:agent_request]'). Do NOT add any other text.
    2.  If no action is triggered, analyze the user's question. You MUST answer it using ONLY the information from the CONTEXT section. Do not use any external knowledge.
    3.  If the CONTEXT does not contain the information needed to answer the question, you MUST respond with the following exact phrase and nothing else: "We’d love to assist you further! Kindly share your contact details and one of our customer care representatives will contact you shortly."
    4.  If the user provides a simple greeting, engages in small talk, or expresses gratitude (e.g., 'hi', 'how are you', 'thanks'), respond naturally and courteously. Do not use the CONTEXT for these interactions.
    5.  Never invent answers. If you are not 100% sure the answer is in the CONTEXT, use the fallback phrase from rule #3.
    `;
    const defaultPersonality = 'You are a helpful and professional customer support assistant.';
    const personality = customInstruction || customInstruction === '' ? customInstruction : defaultPersonality;
    const actionInstruction = `
// --- ACTION TRIGGER ---
If the user's intent clearly matches one of the following, respond ONLY with the tag.

1.  **[ACTION:agent_request]**: The user is expressing frustration, is asking for help that you determine is not available in the CONTEXT, or is explicitly asking to speak to a human, a person, an agent, or wants live support.
    - User says: "I need to talk to a real person." -> Your response: [ACTION:agent_request]
    - User says: "This is frustrating, connect me to an agent." -> Your response: [ACTION:agent_request]

2.  **[ACTION:scheduler]**: The user has a clear intent to book a meeting, schedule a demo, set up a call, or ask for a callback. Do NOT trigger this for general pricing or info questions.
    - User says: "This sounds great, can I book a demo?" -> Your response: [ACTION:scheduler]
    - User says: "Can you have someone call me back?" -> Your response: [ACTION:scheduler]

If no action is needed, proceed to Rule #2.
--- END ACTION TRIGGER ---
`;
    return {
        role: 'system',
        content: `
${nonNegotiableRule}
${actionInstruction}
// --- BOT PERSONALITY ---
${personality}
// --- CONTEXT ---
CONTEXT:
${knowledgeBase || 'No relevant information found in the knowledge base.'}
--- END CONTEXT ---
`
    } as const;
};

export const createChatSession = (systemInstruction: { role: 'system'; content: string }, history: Array<{ role: string; parts: Array<{ text: string }> }>) => {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    messages.push(systemInstruction);
    for (const h of history) {
        const role = h.role === 'user' ? 'user' : 'assistant';
        messages.push({ role, content: h.parts.map(p => p.text).join('\n') });
    }
    return messages;
};

const formatPromptForLlama3 = (messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): string => {
    let prompt = '<|begin_of_text|>';

    const systemMsg = messages.find(m => m.role === 'system');
    if (systemMsg && systemMsg.content) {
        prompt += `<|start_header_id|>system<|end_header_id|>\n\n${systemMsg.content}<|eot_id|>`;
    }

    const conversation = messages.filter(m => m.role !== 'system');
    for (const msg of conversation) {
        if (!msg.content) continue;
        prompt += `<|start_header_id|>${msg.role}<|end_header_id|>\n\n${msg.content}<|eot_id|>`;
    }

    prompt += `<|start_header_id|>assistant<|end_header_id|>\n\n`;

    return prompt;
};

export const sendMessageToChat = async (messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, message: string): Promise<string> => {
    const finalMessages = messages.concat([{ role: 'user', content: message }]);
    const fullPrompt = formatPromptForLlama3(finalMessages);
    const response = await generateChatResponse(fullPrompt);
    return response.trim();
};

export const generateAiResponse = async (
    sessionId: string,
    lastUserMessage: string,
    aiNodeData?: { customPrompt?: string; disableKnowledgeBase?: boolean }
): Promise<{ fullText: string; cleanText: string; action: string | null }> => {
    let fullText = '';
    let action: string | null = null;
    let cleanText = '';

    try {
        const session = await prisma.session.findUnique({
            where: { sessionId },
            select: { companyId: true, botId: true }
        });
        if (!session || !session.botId) throw new Error('Session or associated bot not found.');

        const bot = await prisma.bot.findUnique({
            where: { id: session.botId },
            select: {
                id: true,
                companyName: true,
                companyDescription: true,
            }
        });
        if (!bot) throw new Error('Bot not found for this session.');

        const history = await prisma.message.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' }, take: 10 });
        let historyForAI = history.map((msg: any) => ({ role: msg.role === Role.USER ? 'user' : 'model', parts: [{ text: msg.text }] }));
        if (historyForAI.length > 0 && historyForAI[0].role === 'model') historyForAI = historyForAI.slice(1);


        // Look up visitor info (from the pre-chat form) so the Python backend
        // always knows the user's name / email / phone.
        let userDetailsPayload: { name?: string; email?: string; phone_number?: string } | undefined;
        try {
            const visitor = await prisma.visitor.findFirst({ where: { sessionId } });
            if (visitor && (visitor.name || visitor.email || visitor.phone)) {
                userDetailsPayload = {
                    ...(visitor.name ? { name: visitor.name } : {}),
                    ...(visitor.email ? { email: visitor.email } : {}),
                    ...(visitor.phone ? { phone_number: visitor.phone } : {}),
                };
            }
        } catch (err) {
            console.error('[genaiService] Failed to fetch visitor info:', err);
        }

        const response = await fetch(`${process.env.THIRD_PARTY_SERVICE_BASE_URL}/generate-ai-response`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                bot_id: session.botId,
                session_id: sessionId,
                user_query: lastUserMessage,
                tenant_name: bot.companyName || null,
                tenant_description: bot.companyDescription || null,
                ai_node_data: aiNodeData || {},
                user_details: userDetailsPayload || null,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI Response Service] Third-party API error for session ${sessionId}: ${response.status} ${errorText}`);
            throw new Error(`Third-party API request failed with status ${response.status}`);
        }

        const aiResult = await response.json();
        
        fullText = aiResult.fullText;
        cleanText = aiResult.cleanText;
        action = aiResult.action;


        if (cleanText) {
            const finalBotMessage = { id: uuidv4(), role: Role.MODEL, text: cleanText, createdAt: new Date().toISOString() };
            sendToSession(sessionId, finalBotMessage);
            await prisma.message.create({ data: { ...finalBotMessage, sessionId: sessionId } });
            notifyAdmin(session.companyId, 'newMessage', { sessionId, message: finalBotMessage });
        }
        
        return { fullText, cleanText, action };
    } catch (aiError) {
        console.error(`[AI Response Service] Failed for session ${sessionId}:`, aiError);
        const errorMessage = { id: uuidv4(), role: Role.MODEL, text: "I'm sorry, I encountered an error. Please try again.", createdAt: new Date().toISOString() };
        sendToSession(sessionId, errorMessage);
        await prisma.message.create({ data: { ...errorMessage, sessionId } });
        return { fullText: '', cleanText: '', action: null };
    }
};
