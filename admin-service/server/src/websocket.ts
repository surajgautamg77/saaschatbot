import { WebSocketServer, WebSocket } from 'ws';
import { Server, IncomingMessage } from 'http';
import { type ServerToClientSocketMessage, type User } from './types';
import { verifyToken } from './utils/auth.js';
import { executeFlowFromNode } from './services/flowExecutorService.js';
import prisma from './db.js';

interface DecodedToken {
    userId: string;
    companyId: string;
}

interface AuthenticatedWebSocket extends WebSocket {
    userId: string;
    companyId: string;
    isMember: boolean;
    isSuperAdmin: boolean;
}

const sessionSockets = new Map<string, WebSocket>();
const memberSockets = new Map<string, Map<string, AuthenticatedWebSocket[]>>(); // companyId -> Map<userId, socket>
const superAdminSockets = new Map<string, AuthenticatedWebSocket[]>(); // userId -> socket
const disconnectTimers = new Map<string, NodeJS.Timeout>();

const handleUserDisconnect = async (userId: string) => {
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
    } catch (error) {
        console.error('Error handling user disconnect:', error);
    }
};

export const initializeWebSocket = (server: Server) => {
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', async (request: IncomingMessage, socket, head) => {
        const { pathname, searchParams } = new URL(request.url!, `http://${request.headers.host}`);
        const effectivePath = pathname.startsWith('/server') ? pathname.substring(7) : pathname;

        if (effectivePath.startsWith('/ws/chat/')) {
            wss.handleUpgrade(request, socket, head, (ws) => {
                (ws as AuthenticatedWebSocket).isMember = false;
                (ws as AuthenticatedWebSocket).isSuperAdmin = false;
                wss.emit('connection', ws, request);
            });
        } else if (effectivePath === '/ws/admin' || effectivePath === '/ws/super-admin') {
            const token = searchParams.get('token');
            const decoded = token ? (verifyToken(token) as DecodedToken | null) : null;
            if (!decoded?.userId) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }

            const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
            if (!user) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }

            const isSuperAdmin = user.role === 'SUPER_ADMIN';
            
            if (!isSuperAdmin && !decoded.companyId) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }

            wss.handleUpgrade(request, socket, head, (ws) => {
                const authWs = ws as AuthenticatedWebSocket;
                authWs.userId = decoded.userId;
                authWs.companyId = decoded.companyId;
                // A user is a "member" if they are not a SUPER_ADMIN.
                authWs.isMember = !isSuperAdmin; 
                // The user's SUPER_ADMIN status is determined by their role, not the path.
                authWs.isSuperAdmin = isSuperAdmin; 
                wss.emit('connection', ws, request);
            });
        } else {
            socket.destroy();
        }
    });

    wss.on('connection', async (ws: AuthenticatedWebSocket, request: IncomingMessage) => {
        const { pathname } = new URL(request.url!, `http://${request.headers.host}`);
        const effectivePath = pathname.startsWith('/server') ? pathname.substring(7) : pathname;

        if (ws.isSuperAdmin) {
            const { userId } = ws;
            console.log(`[WSS SuperAdmin] Connected: User ${userId}`);
            if (disconnectTimers.has(userId)) {
                console.log(`[WSS SuperAdmin] Reconnected quickly: User ${userId}. Cancelling disconnect timer.`);
                clearTimeout(disconnectTimers.get(userId)!);
                disconnectTimers.delete(userId);
            }
            const existingSockets = superAdminSockets.get(userId) || [];
            superAdminSockets.set(userId, [...existingSockets, ws]);

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    if (data.type === 'ping' && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'pong' }));
                    }
                } catch (e) { /* Ignore non-JSON messages */ } 
            });

            ws.on('close', () => {
                console.log(`[WSS SuperAdmin] Disconnected: User ${userId}`);
                const existingSockets = superAdminSockets.get(userId) || [];
                const remainingSockets = existingSockets.filter(socket => socket !== ws);

                if (remainingSockets.length > 0) {
                    superAdminSockets.set(userId, remainingSockets);
                } else {
                    superAdminSockets.delete(userId);
                    const timer = setTimeout(() => {
                        console.log(`[WSS SuperAdmin] Disconnect timer expired for User ${userId}. Handling disconnect.`);
                        handleUserDisconnect(userId);
                        disconnectTimers.delete(userId);
                    }, 5000); // 5-second grace period
                    disconnectTimers.set(userId, timer);
                }
            });
        } else if (ws.isMember) {
            const { companyId, userId } = ws;
            console.log(`[WSS Member] Connected: User ${userId} for Company ${companyId}`);

            if (disconnectTimers.has(userId)) {
                console.log(`[WSS Member] Reconnected quickly: User ${userId}. Cancelling disconnect timer.`);
                clearTimeout(disconnectTimers.get(userId)!);
                disconnectTimers.delete(userId);
            }

            if (!memberSockets.has(companyId)) {
                memberSockets.set(companyId, new Map());
            }
            const companySockets = memberSockets.get(companyId)!;
            const existingSockets = companySockets.get(userId) || [];
            companySockets.set(userId, [...existingSockets, ws]);

            const connectedMember = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
            if (!connectedMember) {
                ws.close();
                return;
            }

            // --- GLOBAL ONLINE LIST LOGIC ---
            // Original logic for single-company agents
            const companyMemberSockets = memberSockets.get(companyId);
            if (companyMemberSockets) {
                const onlineUserIds = Array.from(companyMemberSockets.keys());
                const onlineMembers = await prisma.user.findMany({
                    where: { id: { in: onlineUserIds }, companyId },
                    select: { id: true, email: true, role: true }
                });
                ws.send(JSON.stringify({ type: 'onlineMembersList', payload: onlineMembers }));
            } else {
                // If no members for this company, send an empty list or handle as appropriate
                ws.send(JSON.stringify({ type: 'onlineMembersList', payload: [] }));
            }
            
            // --- BROADCASTING PRESENCE ---
            // Notify other users that this user has come online.
            // This is only sent when the first connection for a user is established.
            if (existingSockets.length === 0) {
                memberSockets.forEach((companySockets, mapCompanyId) => {
                    companySockets.forEach((userSockets, id) => {
                        if (id !== userId) {
                            userSockets.forEach(socket => {
                                if (socket.readyState === WebSocket.OPEN) {
                                    if (mapCompanyId === companyId) {
                                        socket.send(JSON.stringify({ type: 'memberOnline', payload: connectedMember }));
                                    }
                                }
                            });
                        }
                    });
                });
            }

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    if (data.type === 'ping' && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'pong' }));
                    }
                } catch (e) { /* Ignore non-JSON messages */ } 
            });

            ws.on('close', () => {
                console.log(`[WSS Member] Disconnected: User ${userId} from Company ${companyId}`);
                
                const companySockets = memberSockets.get(companyId);
                if (companySockets) {
                    const existingSockets = companySockets.get(userId) || [];
                    const remainingSockets = existingSockets.filter(socket => socket !== ws);

                    if (remainingSockets.length > 0) {
                        companySockets.set(userId, remainingSockets);
                    } else {
                        companySockets.delete(userId);
                        if (companySockets.size === 0) {
                            memberSockets.delete(companyId);
                        }

                        const timer = setTimeout(() => {
                            console.log(`[WSS Member] Disconnect timer expired for User ${userId}. Handling disconnect.`);
                            handleUserDisconnect(userId);
                            disconnectTimers.delete(userId);
                        }, 5000); // 5-second grace period
                        disconnectTimers.set(userId, timer);
                    }
                    
                    // Notify other users that this user has gone offline.
                    // This notification should be sent regardless of whether it was the last socket.
                    // However, we only send the "offline" message if the user has no more connections.
                    if (remainingSockets.length === 0) {
                        memberSockets.forEach((sockets, mapCompanyId) => {
                            sockets.forEach((userSockets, otherUserId) => {
                                userSockets.forEach(socket => {
                                    if (socket.readyState === WebSocket.OPEN) {
                                        if (mapCompanyId === companyId) {
                                            socket.send(JSON.stringify({ type: 'memberOffline', payload: { id: userId } }));
                                        }
                                    }
                                });
                            });
                        });
                    }
                }
            });
        } else {
            if (!effectivePath) return ws.close();
            const sessionId = effectivePath.split('/ws/chat/')[1];
            console.log(`[WSS Client] Connected for session: ${sessionId}`);
            (async () => {
                const session = await prisma.session.findUnique({ where: { sessionId } });
                if (!session) {
                    console.error(`[WSS] Session ${sessionId} not found. Closing connection.`);
                    return ws.close();
                }

                sessionSockets.set(sessionId, ws);
                const updatedSession = await prisma.session.update({
                    where: { sessionId },
                    data: { isOnline: true, lastSeen: Date.now() },
                    select: {
                        sessionId: true, status: true, chatStatus: true, lastSeen: true, lastMessage: true,
                        ip: true, userAgent: true, location: true, sessionNumber: true,
                        requiresAttention: true, isToReassign: true, isOnline: true, companyId: true,
                        assignedTo: { select: { id: true, email: true } },
                        company: { select: { id: true, name: true } },
                        bot: { select: { name: true } },
                    }
                });
                const serializableSession = { ...updatedSession, lastSeen: updatedSession.lastSeen.toString() };
                notifyAdmin(updatedSession.companyId, 'userUpdate', { session: serializableSession }); 
            })();

            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    if (data.type === 'ping' && sessionId) {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'pong' }));
                        }
                        await prisma.session.update({ where: { sessionId }, data: { lastSeen: Date.now() } });
                    } else if (data.type === 'start_flow' && sessionId) {
                        const session = await prisma.session.findUnique({
                            where: { sessionId },
                            select: { botId: true, currentNodeId: true, companyId: true }
                        });

                        if (!session || !session.botId) { return; }

                        const startNode = await prisma.node.findFirst({
                            where: { botId: session.botId, type: 'startNode' }
                        });

                        if (!startNode) { return; }

                        const startEdge = await prisma.edge.findFirst({
                            where: { sourceNodeId: startNode.id }
                        });

                        if (startEdge && session.currentNodeId === startNode.id) {
                            try {
                                await executeFlowFromNode(sessionId, session.botId, startEdge.targetNodeId);
                            } catch (error) { 
                                console.error(`[WebSocket] Error during start_flow execution for session ${sessionId}:`, error);
                            }
                        }
                    }

                } catch (e) { /* Ignore */ } 
            });

            ws.on('close', () => {
                console.log(`[WSS Client] Disconnected for session: ${sessionId}`);
                sessionSockets.delete(sessionId);
                (async () => {
                    try {
                        const session = await prisma.session.update({ where: { sessionId }, data: { isOnline: false } });
                        notifyAdmin(session.companyId, 'userUpdate', {});
                    } catch (error) { console.error(`[WSS] Failed to set session ${sessionId} to offline:`, error); } 
                })();
            });
        }
    });

    console.log('WebSocket server initialized.');
};

export const sendToSession = (sessionId: string, message: ServerToClientSocketMessage) => {
    const socket = sessionSockets.get(sessionId);
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    }
};

export const notifyAdmin = (companyId: string, type: string, payload: any) => {
    const message = JSON.stringify({ type, payload });

    // First, notify all SUPER_ADMINs unconditionally.
    superAdminSockets.forEach(sockets => {
        sockets.forEach(socket => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(message);
            }
        });
    });

    // Next, iterate through all other connected members.
    memberSockets.forEach((companySockets) => {
        companySockets.forEach(userSockets => {
            userSockets.forEach(socket => {
                // Don't send a second message to a SUPER_ADMIN who might also be in a member list.
                if (socket.isSuperAdmin) return;

                // Send the message if the user belongs to the event's company.
                if (socket.readyState === WebSocket.OPEN && (socket.companyId === companyId)) {
                    socket.send(message);
                }
            });
        });
    });
};

export const notifySuperAdmins = (type: string, payload: any) => {
    const message = JSON.stringify({ type, payload });
    superAdminSockets.forEach(sockets => {
        sockets.forEach(socket => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(message);
            }
        });
    });
};

export const notifyAll = (type: string, payload: any) => {
    const message = JSON.stringify({ type, payload });

    // Notify all SUPER_ADMINs
    superAdminSockets.forEach(sockets => {
        sockets.forEach(socket => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(message);
            }
        });
    });

    // Notify all members of all companies
    memberSockets.forEach((companySockets) => {
        companySockets.forEach(userSockets => {
            userSockets.forEach(socket => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(message);
                }
            });
        });
    });
};
