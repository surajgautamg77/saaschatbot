

import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { apiClient } from '../api/apiClient';

import { useAuthStore } from '../store/authStore';

import { LiveUser, ChatMessage, Role, User, Note } from '../types';

import { LiveUsersPanel } from '../components/LiveUsersPanel';

import { LiveChatWindow } from '../components/LiveChatWindow';

import { MyChatsPanel } from '../components/MyChatsPanel';

import { useSoundStore } from '../store/useSoundStore';

import { useWebSocketStore } from '../store/useWebSocketStore';

import { usePermissionStore } from '../store/usePermissionStore';

import { toast } from 'react-toastify';



export const LiveChatPage: React.FC = () => {

    const [liveUsers, setLiveUsers] = useState<LiveUser[]>([]);

    const [onlineTeam, setOnlineTeam] = useState<User[]>([]);

    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const [privateNotes, setPrivateNotes] = useState<Note[]>([]);

    const [sessionStatus, setSessionStatus] = useState<'bot' | 'admin'>('bot');

    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const currentUser = useAuthStore(state => state.user);

    const { soundEnabled } = usePermissionStore();

    const [unreadSessions, setUnreadSessions] = useState(new Set<string>());

    const { ringingSessionId, setRingingSessionId } = useSoundStore();

    const { lastMessage } = useWebSocketStore();



    const fetchLiveUsers = useCallback(async () => {

        setError(null);

        try {

            const data = await apiClient.get<LiveUser[]>('/live-users');

            setLiveUsers(data);

        } catch (error) {

            console.error("Failed to fetch live users", error);

            setError(error instanceof Error ? error.message : 'Failed to fetch live users.');

        }

    }, []);



    const fetchChatHistory = useCallback(async (sessionId: string) => {

        setIsLoadingHistory(true);

        try {

            const data = await apiClient.get<{ messages: ChatMessage[], status: 'bot' | 'admin', privateNotes: Note[] }>(`/live-chat?sessionId=${sessionId}`);

            setMessages(data.messages);

            setSessionStatus(data.status);

            setPrivateNotes(data.privateNotes || []);

        } catch (error) {

            console.error(`Failed to fetch chat history for ${sessionId}`, error);

            setMessages([]);

            setPrivateNotes([]);

        } finally { setIsLoadingHistory(false); }

    }, []);



    useEffect(() => {

        fetchLiveUsers();

    }, [fetchLiveUsers]);



    useEffect(() => {

        if (lastMessage) {

            const data = lastMessage;

            switch (data.type) {

                case 'userUpdate':

                case 'sessionAssigned':

                case 'sessionUpdated':

                    fetchLiveUsers();

                    break;

                case 'chats_reassigned':

                case 'chat_updated':

                    fetchLiveUsers();

                    break;

                case 'newMessage': {

                    const { sessionId, message } = data.payload;

                    setLiveUsers(prev => prev.map(user => user.sessionId === sessionId ? { ...user, lastMessage: message.text } : user));

                    if (sessionId === activeSessionId) {

                        setMessages(prev => prev.some(msg => msg.id === message.id) ? prev : [...prev, message]);

                    }

                    if (sessionId !== activeSessionId) {

                        setUnreadSessions(prev => new Set(prev).add(sessionId));

                    }

                    break;

                }

                case 'onlineMembersList':

                    setOnlineTeam(data.payload);

                    break;

                case 'memberOnline':

                    setOnlineTeam(prev => [...prev.filter(m => m.id !== data.payload.id), data.payload]);

                    break;

                case 'memberOffline':

                    setOnlineTeam(prev => prev.filter(member => member.id !== data.payload.id));

                    break;

                case 'privateNoteAdded': {

                    const { sessionId: noteSessionId, note } = data.payload;

                    if (noteSessionId === activeSessionId) {

                        setPrivateNotes(prev => [...prev, note]);

                    }

                    break;

                }

            }

        }

    }, [lastMessage, activeSessionId, soundEnabled, fetchLiveUsers]);



    const handleSelectUser = (sessionId: string) => {

        if (sessionId === ringingSessionId) {

            setRingingSessionId(null);

        }

        if (activeSessionId !== sessionId) {

            setActiveSessionId(sessionId);

            fetchChatHistory(sessionId);

            setUnreadSessions(prev => {

                const newSet = new Set(prev);

                newSet.delete(sessionId);

                return newSet;

            });

        }

    };



    const handleSendMessage = async (text: string) => {

        if (!activeSessionId) return;

        const adminMessage: ChatMessage = { id: crypto.randomUUID(), role: Role.ADMIN, text, createdAt: new Date().toISOString() };

        setMessages(prev => [...prev, adminMessage]);

        try {

            await apiClient.post('/live-chat/admin', { sessionId: activeSessionId, message: adminMessage });

        } catch (error) {

            console.error(`Failed to send admin message for sessionId: ${activeSessionId}`, error);

            setMessages(prev => prev.filter(m => m.id !== adminMessage.id));

            alert('Failed to send message. Please try again.');

        }

    };



    const handleAssignChat = async (sessionId: string, agentId: string) => {

        setLiveUsers(prev => prev.map(user => user.sessionId === sessionId ? { ...user, assignedTo: { id: agentId, email: currentUser!.email } } : user));

        if ( sessionId === activeSessionId) setSessionStatus('admin');

        try {

            await apiClient.put('/live-chat/assign', { sessionId, agentId });

        } catch (error) {

            alert(error instanceof Error ? error.message : "Failed to assign chat.");

            fetchLiveUsers();

        }

    };



    const handleTransfer = async (targetAgentId: string) => {

        if (!activeSessionId) return;

        try {

            await apiClient.put('/live-chat/transfer', { sessionId: activeSessionId, targetAgentId });

        } catch (error) {

            alert(`Failed to transfer chat: ${error instanceof Error ? error.message : 'Unknown error'}`);

        }

    };



    const handleReturnToBot = async () => {

        if (!activeSessionId) return;

        if (!window.confirm("Are you sure you want to return this chat to the bot?")) return;

        try {

            await apiClient.put('/live-chat/return-to-bot', { sessionId: activeSessionId });

            setActiveSessionId(null);

        } catch (error) {

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            alert(`Failed to return chat to bot: ${errorMessage}`);

            if (errorMessage.includes('Session not found')) {

                setLiveUsers(prev => prev.filter(user => user.sessionId !== activeSessionId));

                setActiveSessionId(null);

            }

        }

    };



    const onlineLiveUsers = useMemo(() => liveUsers.filter(user => user.isOnline), [liveUsers]);



    const { myChats, otherChats } = useMemo(() => {

        const myChats: LiveUser[] = [];

        const otherChats: LiveUser[] = [];

        onlineLiveUsers.forEach(user => {

            if (user.assignedTo?.id === currentUser?.id) myChats.push(user);

            else otherChats.push(user);

        });

        return { myChats, otherChats };

    }, [onlineLiveUsers, currentUser]);



    const activeLiveUser = onlineLiveUsers.find(u => u.sessionId === activeSessionId);

    const onlineAgentsForTransfer = onlineTeam.filter(member => member.id !== currentUser?.id);

    const isSessionActionable = useMemo(() => !!activeSessionId && !!activeLiveUser, [activeSessionId, activeLiveUser]);



    return (

        <div className="grid grid-cols-1 md:grid-cols-[400px,1fr] gap-6 h-[calc(100vh-200px)]">

            <div className="flex flex-col gap-6 h-full">

                <MyChatsPanel

                    myChats={myChats}

                    activeSessionId={activeSessionId}

                    onSelectUser={handleSelectUser}

                    error={error}

                    unreadSessions={unreadSessions}

                    ringingSessionId={ringingSessionId}

                />

                <LiveUsersPanel

                    users={otherChats}

                    activeSessionId={activeSessionId}

                    onSelectUser={handleSelectUser}

                    currentUser={currentUser}

                    onlineAgents={onlineTeam}

                    onAssign={handleAssignChat}

                    error={error}

                    unreadSessions={unreadSessions}

                    ringingSessionId={ringingSessionId}

                />

            </div>

            <LiveChatWindow

                sessionId={activeSessionId}

                messages={messages}

                sessionStatus={sessionStatus}

                isLoading={isLoadingHistory}

                onSendMessage={handleSendMessage}

                onAssignToSelf={() => { if (activeSessionId && currentUser) { handleAssignChat(activeSessionId, currentUser.id); toast.dismiss(); }}}

                onTransfer={handleTransfer}

                onReturnToBot={handleReturnToBot}

                activeLiveUser={activeLiveUser || null}

                currentUser={currentUser}

                assignedAgent={activeLiveUser?.assignedTo || null}

                allTeamMembers={onlineAgentsForTransfer}

                privateNotes={privateNotes}

                isSessionActionable={isSessionActionable}

            />

        </div>

    );

};