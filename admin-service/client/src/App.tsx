import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { DemoScheduler } from './components/DemoScheduler';
import { UserInfoForm, type UserInfo } from './components/UserInfoForm';
import { Role, type ChatMessage, type BookingDetails, type Bot, type Company } from './types';
import { MinimizeIcon, RefreshIcon } from './components/Icons';
import { logoObject } from './assets/logo';
import { 
    isSessionExpired, 
    isSessionExpiredByAge, 
    clearExpiredSession, 
    saveSessionMetadata, 
    updateSessionActivity,
    isSessionInactivelyExpired
} from './utils/sessionExpiry';

interface AppProps {
    apiBaseUrl: string;
    publicApiKey: string;
    shadowRoot: ShadowRoot;
}

type PublicBotSettings = Bot & Pick<Company, 'timeZone' | 'businessHoursStart' | 'businessHoursEnd'> & { chatInactivityTimeout?: number | null };

const App: React.FC<AppProps> = ({ apiBaseUrl, publicApiKey, shadowRoot }) => {
    const [settings, setSettings] = useState<PublicBotSettings | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isBookingFlowActive, setIsBookingFlowActive] = useState<boolean>(false);
    const [isBooking, setIsBooking] = useState<boolean>(false);
    const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [chatMode, setChatMode] = useState<'bot' | 'admin'>('bot');
    const [error, setError] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState<boolean>(false);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [isSubmittingUserInfo, setIsSubmittingUserInfo] = useState<boolean>(false);
    const wsRef = useRef<WebSocket | null>(null);
    const CLEARED_AT_PREFIX = 'rhysley-cleared-at-';

    // This ref is the core of the fix to prevent "zombie" reconnections.
    const isMounted = useRef(true);

    // This effect ensures we know when the component is unmounted.
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Effect to restore userInfo from localStorage on mount and check expiry
    useEffect(() => {
        const USER_INFO_KEY = 'rhysley-user-info';
        const savedUserInfo = localStorage.getItem(USER_INFO_KEY);
        
        // Check if session has expired based on bot settings
        const expiryHours = settings?.historyExpiryHours || 24;
        const inactivityTimeoutSeconds = settings?.chatInactivityTimeout || 300; // Default to 5 minutes if not set

        if (isSessionExpired(expiryHours) || isSessionExpiredByAge(7) || isSessionInactivelyExpired(inactivityTimeoutSeconds)) {
            console.log('[Session] Cleared expired session');
            clearExpiredSession();
            return;
        }
        
        if (savedUserInfo) {
            try {
                const parsedUserInfo = JSON.parse(savedUserInfo);
                setUserInfo(parsedUserInfo);
                // Update activity on restore
                updateSessionActivity();
            } catch (err) {
                console.error('Failed to parse saved user info:', err);
            }
        }
    }, [settings]);

    // Effect to fetch bot settings
    useEffect(() => {
        if (!publicApiKey) return;
        const fetchBotSettings = async () => {
            try {
                const response = await fetch(`${apiBaseUrl}/api/bots/public/${publicApiKey}`);
                if (!response.ok) throw new Error('Could not load bot settings.');
                const botSettings: PublicBotSettings = await response.json();
                // Ensure formFields is parsed if it's a string
                if (botSettings.formFields && typeof botSettings.formFields === 'string') {
                    botSettings.formFields = JSON.parse(botSettings.formFields);
                }
                setSettings(botSettings);
                const delay = botSettings.popupDelay || 0;
                setTimeout(() => setIsVisible(true), delay * 1000);
            } catch (e) {
                console.error("Failed to fetch bot settings.", e);
                const fallbackSettings: PublicBotSettings = {
                    id: '', name: '', publicApiKey: '',
                    botName: 'Chatbot', welcomeMessage: 'Hello! How can I help?',
                    widgetColor: '#2563eb', botLogoUrl: null, popupDelay: 0, // Royal Blue
                    timeZone: 'UTC', businessHoursStart: 9, businessHoursEnd: 17
                };
                setSettings(fallbackSettings);
                setIsVisible(true);
            }
        };
        fetchBotSettings();
    }, [publicApiKey, apiBaseUrl]);

    // Effect to apply theme color
    useEffect(() => {
        if (settings?.widgetColor) {
            (shadowRoot.host as HTMLElement).style.setProperty('--rhysley-brand-color', settings.widgetColor);
        }
    }, [settings, shadowRoot]);

    // Effect to initialize the session
    useEffect(() => {
        const SESSION_KEY = 'rhysley-chat-session-id';
        const SESSIONS_BY_EMAIL_KEY = 'rhysley-sessions-by-email';
        const initializeSession = async () => {
            if (!publicApiKey || !settings) {
                setError("Configuration error: Missing API key or settings.");
                return;
            }

            // Look up an existing session by visitor email, if any
            let existingSessionId: string | null = null;
            if (userInfo?.email) {
                const raw = localStorage.getItem(SESSIONS_BY_EMAIL_KEY);
                if (raw) {
                    try {
                        const map = JSON.parse(raw) as Record<string, string>;
                        if (typeof map[userInfo.email] === 'string') {
                            existingSessionId = map[userInfo.email];
                        }
                    } catch (e) {
                        console.error('Failed to parse sessions-by-email map:', e);
                    }
                }
            }

            try {
                const response = await fetch(`${apiBaseUrl}/api/live-session/resume-or-create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        publicApiKey, 
                        sessionId: existingSessionId,
                        userInfo: userInfo || undefined
                    }),
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Could not connect.');
                }
                const data = await response.json();
                setSessionId(data.sessionId);
                localStorage.setItem(SESSION_KEY, data.sessionId);
                // Record session metadata so expiry based on
                // settings.historyExpiryHours works correctly.
                saveSessionMetadata(data.sessionId, userInfo?.email);

                // Persist mapping from visitor email to session so multiple visitors
                // can resume their own chats independently on the same device.
                if (userInfo?.email) {
                    let map: Record<string, string> = {};
                    const raw = localStorage.getItem(SESSIONS_BY_EMAIL_KEY);
                    if (raw) {
                        try {
                            map = JSON.parse(raw) || {};
                        } catch (e) {
                            console.error('Failed to parse sessions-by-email map when saving:', e);
                            map = {};
                        }
                    }
                    map[userInfo.email] = data.sessionId;
                    localStorage.setItem(SESSIONS_BY_EMAIL_KEY, JSON.stringify(map));
                }
                const initialMessages = data.messages || [];

                // Respect any local "clear chat" for this session by
                // hiding messages older than the last cleared-at timestamp.
                const clearedAtKey = `${CLEARED_AT_PREFIX}${data.sessionId}`;
                const clearedAtRaw = localStorage.getItem(clearedAtKey);
                let filteredMessages = initialMessages;
                if (clearedAtRaw) {
                    const clearedAt = new Date(clearedAtRaw);
                    if (!isNaN(clearedAt.getTime())) {
                        filteredMessages = initialMessages.filter(m => {
                            if (!m.createdAt) return true;
                            const created = new Date(m.createdAt);
                            return isNaN(created.getTime()) || created > clearedAt;
                        });
                    }
                }

                if (filteredMessages.length === 0 && settings.welcomeMessage) {
                    setMessages([{ id: 'welcome-msg', role: Role.MODEL, text: settings.welcomeMessage }]);
                } else {
                    setMessages(filteredMessages);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "The backend might be offline.");
                localStorage.removeItem(SESSION_KEY);
            } finally {
                setIsSubmittingUserInfo(false);
            }
        };
        // Initialize session if chat is open and:
        // 1. No session exists yet
        // 2. Settings are loaded
        // 3. Either user has filled the form OR the form is disabled
        if (isChatOpen && !sessionId && settings && (userInfo || settings.showUserForm === false)) {
            initializeSession();
        }
    }, [apiBaseUrl, publicApiKey, isChatOpen, sessionId, settings, userInfo]);

    // --- THIS IS THE FULLY CORRECTED WEBSOCKET LOGIC ---
    useEffect(() => {
        // If chat is closed or session is not ready, do nothing and ensure cleanup.
        if (!sessionId || !isChatOpen) {
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
                wsRef.current = null;
            }
            return;
        }

        let heartbeatInterval: number;

        const connectWebSocket = () => {
            // Guard against connecting if component is unmounting or chat is closed.
            if (!isMounted.current || !isChatOpen) return;

            const url = new URL(apiBaseUrl);
            const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${url.host}${url.pathname}/ws/chat/${sessionId}`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log(`[WSS Client] Connection established: ${sessionId}`);
                ws.send(JSON.stringify({ type: 'start' }));
                heartbeatInterval = window.setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'ping' }));
                    }
                }, 25000);
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'pong') return;
                switch (data.type) {
                    case 'statusUpdate':
                        setChatMode(data.status);
                        if (data.status === 'admin') {
                            setMessages(prev => [...prev, { id: crypto.randomUUID(), role: Role.SYSTEM, text: "**An agent has joined the chat.**" }]);
                        } else if (data.status === 'bot') {
                            setMessages(prev => [...prev, { id: crypto.randomUUID(), role: Role.SYSTEM, text: "**The agent has left the chat.**" }]);
                        }
                        break;
                    case 'invoke_action':
                        if (data.payload?.action === 'scheduler') setIsBookingFlowActive(true);
                        break;
                    case 'choice_response':
                        setIsLoading(false);
                        setMessages(prev => [...prev, data.message]);
                        break;
                    default:
                        setIsLoading(false);
                        setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data]);
                        break;
                }
            };

            ws.onerror = (error) => console.error("[WSS Client] Error:", error);

            ws.onclose = () => {
                console.log("[WSS Client] Connection closed.");
                clearInterval(heartbeatInterval);
                wsRef.current = null;

                // This robust check prevents reconnecting after an intentional close.
                if (isMounted.current && isChatOpen) {
                    console.log("[WSS Client] Attempting to reconnect...");
                    setTimeout(connectWebSocket, 3000);
                }
            };
        }

        connectWebSocket();

        // This is the cleanup function that runs when isChatOpen becomes false.
        return () => {
            clearInterval(heartbeatInterval);
            if (wsRef.current) {
                wsRef.current.onclose = null; // Prevent the onclose handler from firing
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [sessionId, isChatOpen, apiBaseUrl]);

    // All handler functions below are correct and unchanged.
    const handleSendMessage = useCallback(async (text: string) => {
        if (!sessionId) return;

        if (chatMode === 'bot') {
            setIsLoading(true);
        }

        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: Role.USER,
            text,
            createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, userMessage]);
        // Bump last-activity so historyExpiryHours is measured from
        // the most recent user action.
        updateSessionActivity();
        await fetch(`${apiBaseUrl}/api/live-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, message: userMessage }),
        });
    }, [sessionId, apiBaseUrl, chatMode]);

    const sendSystemMessage = useCallback(async (text: string) => {
        if (!sessionId) return;

        const systemMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: Role.SYSTEM,
            text,
            createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, systemMessage]);
        await fetch(`${apiBaseUrl}/api/live-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, message: systemMessage }),
        });
    }, [sessionId, apiBaseUrl]);

    const sendSignalMessage = useCallback(async (text: string) => {
        if (!sessionId) return;
        await fetch(`${apiBaseUrl}/api/live-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, message: { id: crypto.randomUUID(), role: Role.USER, text } }),
        });
    }, [sessionId, apiBaseUrl]);

    const handleConfirmBooking = useCallback(async (details: Omit<BookingDetails, 'id'>) => {
        if (!sessionId) return;
        setIsBooking(true);
        try {
            await fetch(`${apiBaseUrl}/api/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...details, date: details.date.toISOString(), sessionId }),
            });
            sendSignalMessage('__BOOKING_CONFIRMED__');
        } catch (err) {
            setMessages(prev => [...prev, { id: crypto.randomUUID(), role: Role.MODEL, text: `Sorry, there was an error. Please try again.` }]);
        } finally {
            setIsBookingFlowActive(false);
            setIsBooking(false);
        }
    }, [sessionId, apiBaseUrl, sendSignalMessage]);

    const handleCancelBooking = useCallback(() => {
        setIsBookingFlowActive(false);
        setIsLoading(false);
        sendSignalMessage('__BOOKING_CANCELLED__');
    }, [sendSignalMessage]);

    const handleUserInfoSubmit = useCallback((info: UserInfo) => {
        const USER_INFO_KEY = 'rhysley-user-info';
        localStorage.setItem(USER_INFO_KEY, JSON.stringify(info));
        setIsSubmittingUserInfo(true);
        setUserInfo(info);
    }, []);

    const toggleChat = () => {
        // Simply toggle the chat window - don't clear session data
        // This allows users to minimize and reopen without filling the form again
        setIsChatOpen(prev => !prev);
    };

    // Clear only the in-memory messages for the current session (UI),
    // and remember the time so we hide older messages even after refresh.
    const handleClearChatMessages = () => {
        setMessages([]);
        if (sessionId) {
            const clearedAtKey = `${CLEARED_AT_PREFIX}${sessionId}`;
            localStorage.setItem(clearedAtKey, new Date().toISOString());
        }
    };

    // Fully restart the chat locally so the next open shows the form again.
    // We keep the server-side session and history, but:
    // - drop local session id and user info
    // - clear local mappings so a new visitor can fill the form.
    // We also mark the current session as cleared so if it is ever
    // resumed (same email), old messages stay hidden in the widget.
    const handleRefreshChat = () => {
        const SESSION_KEY = 'rhysley-chat-session-id';
        const USER_INFO_KEY = 'rhysley-user-info';
        const SESSIONS_BY_EMAIL_KEY = 'rhysley-sessions-by-email';

        if (sessionId) {
            const clearedAtKey = `${CLEARED_AT_PREFIX}${sessionId}`;
            localStorage.setItem(clearedAtKey, new Date().toISOString());
        }

        setMessages([]);
        setUserInfo(null);
        setSessionId(null);
        setError(null);
        setIsBookingFlowActive(false);

        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(USER_INFO_KEY);
        localStorage.removeItem(SESSIONS_BY_EMAIL_KEY);
    };

    const uiDisabled = isLoading || isBooking;

    if (!isVisible) return null;

    // The JSX below is correct and unchanged.
    return (
        <>
            <button
                onClick={toggleChat}
                className={`cursor-pointer fixed bottom-5 right-5 text-white rounded-full shadow-lg flex items-center justify-center transition-transform z-50 hover:scale-110 ${isChatOpen ? 'scale-0' : 'scale-100'}`}
                style={{ width: '65px' }}
                aria-label="Open chat"
            >
                <img src={logoObject} alt="Chat" />
            </button>

            <div id="rhysley-chat-window" className={`fixed bottom-10 right-5 w-[calc(100%-40px)] h-[60vh] sm:w-[440px] sm:h-[70vh] bg-dark-bg text-dark-text font-sans rounded-2xl shadow-2xl flex flex-col transition-all origin-bottom-right ${isChatOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`} style={{backgroundColor: 'var(--color-dark-bg)'}}>
                <header className="w-full p-4 bg-dark-card flex justify-between items-center rounded-t-2xl" style={{backgroundColor: 'var(--color-dark-card)'}}>
                    <div className="flex items-center gap-3">
                        {settings?.botLogoUrl && <img src={settings.botLogoUrl} alt="Bot Logo" className="w-10 h-10 rounded-full object-cover" />}
                        <h1 className="text-xl font-semibold tracking-wide text-blue-300 drop-shadow-sm">
                            {settings?.botName || 'Chat Support'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleClearChatMessages}
                            className="px-3 py-1 rounded-full text-xs font-medium text-blue-300 hover:bg-blue-900/60 transition-colors border border-blue-400/70 tracking-wide"
                            title="Clear chat"
                        >
                            Clear
                        </button>
                        <button
                            onClick={handleRefreshChat}
                            className="p-2 rounded-full text-blue-300 hover:bg-blue-900/60 transition-colors border border-blue-400/70"
                            title="Start new chat"
                        >
                            <RefreshIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={toggleChat}
                            className="p-2 rounded-full text-blue-300 hover:bg-blue-900/60 transition-colors"
                            title="Minimize"
                        >
                            <MinimizeIcon className="w-6 h-6" />
                        </button>
                    </div>
                </header>
                {error ? (
                    <div className="flex-grow flex items-center justify-center p-4">
                        <div className="bg-red-900/50 text-red-300 p-4 rounded-md">
                            <p className="font-bold">Connection Error</p><p>{error}</p>
                        </div>
                    </div>
                ) : (
                    <div className="w-full flex flex-col flex-1 min-h-0 overflow-y-auto">
                        {!userInfo && settings?.showUserForm !== false ? (
                            <UserInfoForm 
                                onSubmit={handleUserInfoSubmit} 
                                isLoading={isSubmittingUserInfo}
                                fields={settings?.formFields}
                            />
                        ) : isBookingFlowActive ? (
                            <DemoScheduler
                                onConfirmBooking={handleConfirmBooking}
                                onCancel={handleCancelBooking}
                                isSaving={isBooking}
                                publicApiKey={publicApiKey}
                                apiBaseUrl={apiBaseUrl}
                            />
                        ) : (
                            <ChatInterface
                                messages={messages}
                                onSendMessage={handleSendMessage}
                                isLoading={isLoading}
                                disabled={!sessionId || uiDisabled}
                                chatMode={chatMode}
                                isChatOpen={isChatOpen}
                            />
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

export default App;