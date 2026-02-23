

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/apiClient';
import { ChatMessage } from '../types';
import { ChatMessageComponent } from '../components/ChatMessage';
import { BotIcon } from '../components/Icons';

// Define the shape of the data we expect for the list
interface SessionSummary {
    sessionId: string;
    lastMessage: string;
    lastSeen: string;
    location: string | null;
    sessionNumber: number | null;
    status: 'bot' | 'admin';
    chatStatus?: 'GREEN' | 'YELLOW' | 'RED';
    bot: {
        name: string;
    };
    assignedTo: {
        email: string;
    } | null;
    lastAssignedTo: {
        email: string;
    } | null;
}

// Define the shape for the full transcript view
interface SessionTranscript extends SessionSummary {
    ip: string;
    messages: ChatMessage[];
}

export const HistoryPage: React.FC = () => {
    const [sessions, setSessions] = useState<SessionSummary[]>([]);
    const [selectedTranscript, setSelectedTranscript] = useState<SessionTranscript | null>(null);
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    // Fetch the list of sessions
    useEffect(() => {
        const fetchSessions = async () => {
            setIsLoadingList(true);
            try {
                const data = await apiClient.get<SessionSummary[]>('/history');
                setSessions(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load session history.');
            } finally {
                setIsLoadingList(false);
            }
        };
        fetchSessions();
    }, []);

    // Handler to fetch the full transcript when a session is clicked
    const handleSelectSession = useCallback(async (sessionId: string) => {
        setActiveSessionId(sessionId);
        setIsLoadingTranscript(true);
        setSelectedTranscript(null);
        try {
            const data = await apiClient.get<SessionTranscript>(`/history/${sessionId}`);
            setSelectedTranscript(data);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to load transcript.');
        } finally {
            setIsLoadingTranscript(false);
        }
    }, []);

    const getAssignedAgent = (session: SessionSummary | SessionTranscript) => {
        if (session.assignedTo) {
            return session.assignedTo.email;
        }
        if (session.lastAssignedTo) {
            return session.lastAssignedTo.email;
        }
        return 'Unassigned';
    };

    return (
        <div className="flex gap-6 h-[calc(100vh-230px)]">
            {/* Left Panel: Session List */}
            <div className="w-1/3 max-w-sm bg-dark-card rounded-xl shadow-lg flex flex-col">
                <div className="p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">Chat History ({sessions.length})</h2>
                    {/* We can add a search bar here later */}
                </div>
                <div className="flex-1 overflow-y-auto">
                    {isLoadingList && <p className="p-4 text-gray-400">Loading history...</p>}
                    {error && <p className="p-4 text-red-400">{error}</p>}
                    {sessions.map(session => (
                        <button
                            key={session.sessionId}
                            onClick={() => handleSelectSession(session.sessionId)}
                            className={`w-full text-left p-4 border-b border-gray-700 hover:bg-gray-700/50 transition-colors focus:outline-none ${
                                activeSessionId === session.sessionId ? 'bg-blue-900/50 border-l-4 border-blue-500' : 'border-l-4 border-transparent'
                            }`}
                        >
                            {/* +++ NEW BOT NAME DISPLAY +++ */}
                            <div className="flex items-center gap-2 text-sm font-bold text-purple-400 mb-1">
                                <BotIcon className="w-4 h-4" />
                                <span>{session.bot.name}</span>
                            </div>

                            <p className="font-semibold text-gray-200 truncate">
                                User #{session.sessionNumber || '...'}
                            </p>
                            <p className="text-sm italic text-gray-400 truncate mt-1">
                                "{session.lastMessage}"
                            </p>
                            <div className="text-xs text-gray-500 mt-2 flex justify-between">
                                <span>{new Date(parseInt(session.lastSeen)).toLocaleString()}</span>
                                <span className="font-bold">{getAssignedAgent(session)}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Panel: Transcript Viewer */}
            <div className="flex-1 flex flex-col bg-dark-card rounded-xl shadow-lg min-h-0">
                {isLoadingTranscript ? (
                    <div className="flex-1 flex items-center justify-center"><p className="text-gray-400">Loading transcript...</p></div>
                ) : selectedTranscript ? (
                    <>
                        <div className="p-4 border-b border-gray-700">
                            <h3 className="text-lg font-bold text-white">Transcript for User #{selectedTranscript.sessionNumber}</h3>
                            <p className="text-sm text-gray-400">
                                <span className="font-semibold">ID:</span> {selectedTranscript.sessionId.substring(0, 12)}... |
                                <span className="font-semibold ml-2">IP:</span> {selectedTranscript.ip} |
                                <span className="font-semibold ml-2">Date:</span> {new Date(parseInt(selectedTranscript.lastSeen)).toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-300 mt-1">
                                <span className="font-semibold">Handled by:</span> {getAssignedAgent(selectedTranscript)}
                            </p>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto">
                            {selectedTranscript.messages.map(msg => (
                                <ChatMessageComponent key={msg.id} message={msg} />
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-gray-400 text-lg">Select a session from the left to view the transcript.</p>
                    </div>
                )}
            </div>
        </div>
    );
};