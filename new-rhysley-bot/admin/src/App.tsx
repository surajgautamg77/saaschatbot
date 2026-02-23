import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { GlobalTourManager } from './components/GlobalTourManager';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { JoinPage } from './pages/JoinPage';
import { useSoundStore } from './store/useSoundStore';
import { useWebSocketStore } from './store/useWebSocketStore';
import { newMessageNotificationSound, ringtone } from './sounds';
import { apiClient } from './api/apiClient';
import { LiveUser, Role } from './types';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { usePermissionStore } from './store/usePermissionStore';
import { VolumeX } from 'lucide-react';
import { notificationManager } from './utils/notificationManager';

const ProtectedRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

function App() {
    const token = useAuthStore(state => state.token);
    const { ringingSessionId, setRingingSessionId } = useSoundStore();
    const { setLastMessage } = useWebSocketStore();
    const { soundEnabled, setSoundEnabled } = usePermissionStore();
    const ringtoneAudio = useRef<HTMLAudioElement | null>(null);
    const activeSounds = useRef<HTMLAudioElement[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const [liveUsers, setLiveUsers] = useState<LiveUser[]>([]);
    const isInitialLoad = useRef(true);
    const seenSessionIds = useRef(new Set<string>());
    const originalTitle = useRef(document.title); // Store the original document title
    const [unreadCount, setUnreadCount] = useState(0); // State to track unread messages

    const handleEnableSound = () => {
        // This is now the single point of truth for enabling sound.
        // It requires a user click, which is perfect for unlocking autoplay.
        setSoundEnabled(true);
        const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        silentAudio.play().catch(error => {
            if (error.name !== 'NotAllowedError') {
                console.error("Failed to play silent audio for unlocking:", error);
            }
        });
    };

    const playNewMessageSound = () => {
        console.log("Attempting to play new message sound...");
        const audio = new Audio(newMessageNotificationSound);

        // Add to our ref to prevent garbage collection
        activeSounds.current.push(audio);

        audio.play().then(() => {
            console.log("New message sound played successfully.");
        }).catch(err => {
            console.error("Failed to play new message sound:", err);
            // If it fails, remove it from the array
            activeSounds.current = activeSounds.current.filter(a => a !== audio);
        });

        // When the sound finishes playing, remove it from the array
        audio.onended = () => {
            console.log("New message sound finished playing.");
            activeSounds.current = activeSounds.current.filter(a => a !== audio);
        };
    };

    // Effect to handle ringing session sound
    useEffect(() => {
        if (ringingSessionId && soundEnabled) {
            ringtoneAudio.current = new Audio(ringtone);
            ringtoneAudio.current.loop = true;
            ringtoneAudio.current.play().catch(err => console.error("Failed to play ringtone:", err));
        } else if (ringtoneAudio.current) {
            ringtoneAudio.current.pause();
            ringtoneAudio.current = null;
        }

        return () => {
            if (ringtoneAudio.current) {
                ringtoneAudio.current.pause();
                ringtoneAudio.current = null;
            }
        };
    }, [ringingSessionId, soundEnabled]);

    // Effect to manage tab title based on visibility and unread count
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Tab is hidden, do nothing special here for now, title is updated by new messages
            } else {
                // Tab is visible, reset title and unread count
                document.title = originalTitle.current;
                setUnreadCount(0);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.title = originalTitle.current; // Ensure title is reset on unmount
        };
    }, []); // Empty dependency array means this runs once on mount

    // Main WebSocket and live user fetching effect
    useEffect(() => {
        if (!token) return;

        // This local function shadows the global one, consider renaming or making it global
        const playNewMessageSoundEffect = (message: string = "New message received", key: string) => {
            notificationManager.show(message, key);
            console.log("Attempting to play new message sound...");
            const audio = new Audio(newMessageNotificationSound);

            // Add to our ref to prevent garbage collection
            activeSounds.current.push(audio);

            audio.play().then(() => {
                console.log("New message sound played successfully.");
            }).catch(err => {
                console.error("Failed to play new message sound:", err);
                activeSounds.current = activeSounds.current.filter(a => a !== audio);
            });

            audio.onended = () => {
                console.log("New message sound finished playing.");
                activeSounds.current = activeSounds.current.filter(a => a !== audio);
            };
        };

        const fetchAndCompareLiveUsers = async () => {
            try {
                const newLiveUsers = await apiClient.get<LiveUser[]>('/live-users');

                const currentRingingSessionId = useSoundStore.getState().ringingSessionId;
                if (currentRingingSessionId) {
                    const ringingSessionExists = newLiveUsers.some(user => user.sessionId === currentRingingSessionId);
                    if (!ringingSessionExists) {
                        setRingingSessionId(null);
                    }
                }

                setLiveUsers(prevLiveUsers => {
                    if (isInitialLoad.current) {
                        isInitialLoad.current = false;
                        newLiveUsers.forEach(user => seenSessionIds.current.add(user.sessionId));
                    } else {
                        newLiveUsers.forEach(newUser => {
                            if (!seenSessionIds.current.has(newUser.sessionId)) {
                                if (!newUser.assignedTo) {
                                    console.log(`[WSS App] New global session detected: ${newUser.sessionId}`);
                                    setRingingSessionId(newUser.sessionId);
                                    // Update unread count and title if tab is hidden
                                    if (document.hidden) {
                                        setUnreadCount(prev => prev + 1);
                                    }
                                }
                            }
                            seenSessionIds.current.add(newUser.sessionId);
                        });

                        const prevLiveUsersMap = new Map(prevLiveUsers.map(user => [user.sessionId, user]));
                        newLiveUsers.forEach(newUser => {
                            const prevUser = prevLiveUsersMap.get(newUser.sessionId);
                            if (prevUser && prevUser.assignedTo && !newUser.assignedTo) {
                                console.log(`[WSS App] Session ${newUser.sessionId} is now unassigned.`);
                                if (usePermissionStore.getState().soundEnabled) {
                                    playNewMessageSoundEffect("A chat is returned to bot", "chat_returned");
                                }
                                // Update unread count and title if tab is hidden
                                if (document.hidden) {
                                    setUnreadCount(prev => prev + 1);
                                }
                            }
                        });
                    }
                    return newLiveUsers;
                });
            } catch (error) {
                console.error("Failed to fetch live users in App:", error);
            }
        };

        let heartbeatInterval: number;
        const connectWebSocket = () => {
            const url = new URL(window.location.href);
            const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${url.host}/server/ws/admin?token=${token}`;

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[WSS App] Global connection established.');
                fetchAndCompareLiveUsers(); // Initial fetch
                heartbeatInterval = window.setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
                }, 25000);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setLastMessage(data); // Broadcast every message

                    // Get the latest sound state directly from the store to avoid stale closures
                    const isSoundEnabled = usePermissionStore.getState().soundEnabled;

                    if (isSoundEnabled) {
                        switch (data.type) {
                            case 'newMessage': {
                                const { message } = data.payload;
                                if (message.role === Role.USER) {
                                    playNewMessageSoundEffect("New message from user", "new_message");
                                    if (document.hidden) {
                                        setUnreadCount(prev => prev + 1);
                                    }
                                }
                                break;
                            }
                            case 'chats_reassigned':
                            case 'chat_updated': {
                                playNewMessageSoundEffect("Chat status updated", "chat_update");
                                if (document.hidden) {
                                    setUnreadCount(prev => prev + 1);
                                }
                                break;
                            }
                            case 'privateNoteAdded': {
                                const { note } = data.payload;
                                const currentUserId = useAuthStore.getState().user?.id;
                                if (note.agentId !== currentUserId) {
                                    notificationManager.show('New Whisper Note Received!', 'private_note');
                                }
                                break;
                            }
                        }
                    }
                    if (data.type === 'userUpdate') {
                        if (data.payload.session) {
                            const newLiveUser = data.payload.session as LiveUser;

                            setLiveUsers(prevLiveUsers => {
                                const userExists = prevLiveUsers.some(u => u.sessionId === newLiveUser.sessionId);
                                if (userExists) {
                                    // Update existing user
                                    return prevLiveUsers.map(u => u.sessionId === newLiveUser.sessionId ? newLiveUser : u);
                                } else {
                                    // Add new user to the top of the list
                                    return [newLiveUser, ...prevLiveUsers];
                                }
                            });

                            if (!seenSessionIds.current.has(newLiveUser.sessionId)) {
                                if (!newLiveUser.assignedTo) {
                                    console.log(`[WSS App] New session ${newLiveUser.sessionId} detected via WebSocket push.`);
                                    notificationManager.show("A new user has joined the chat!", "new_user");
                                    setRingingSessionId(newLiveUser.sessionId);
                                    if (document.hidden) {
                                        setUnreadCount(prev => prev + 1);
                                    }
                                }
                                seenSessionIds.current.add(newLiveUser.sessionId);
                            }
                        } else {
                            // Fallback for generic updates
                            fetchAndCompareLiveUsers();
                        }
                    } else if (data.type === 'sessionAssigned' || data.type === 'sessionUpdated') {
                        fetchAndCompareLiveUsers();
                    }
                } catch (error) {
                    console.error("Error processing App WebSocket message:", error);
                }
            };

            ws.onerror = (err) => console.error('[WSS App] Global Error:', err);
            ws.onclose = () => {
                console.log('[WSS App] Global connection closed. Reconnecting...');
                clearInterval(heartbeatInterval);
                setTimeout(connectWebSocket, 5000);
            };
        };

        connectWebSocket();

        return () => {
            clearInterval(heartbeatInterval);
            if (wsRef.current) {
                wsRef.current.onclose = () => { };
                wsRef.current.close();
            }
        };
    }, [token, setRingingSessionId, setLastMessage]);

    // Effect to update document title when unreadCount changes
    useEffect(() => {
        if (unreadCount > 0 && document.hidden) {
            document.title = `(${unreadCount}) ${originalTitle.current}`;
        } else if (!document.hidden) {
            document.title = originalTitle.current;
            setUnreadCount(0); // Reset count when tab is active
        }
    }, [unreadCount]);


    return (
        <BrowserRouter basename="/admin">
            <ToastContainer
                position="top-right"
                autoClose={false}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />
            <GlobalTourManager />
            {!soundEnabled && (
                <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-3 text-center z-50 flex items-center justify-center shadow-lg">
                    <VolumeX className="mr-3" />
                    <span className="font-semibold mr-2">Sound is muted.</span>
                    <button onClick={handleEnableSound} className="underline font-bold hover:text-yellow-300 transition-colors">
                        Click here to enable sound notifications.
                    </button>
                </div>
            )}
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/join" element={<JoinPage />} />
                <Route
                    path="/*"
                    element={
                        <ProtectedRoute>
                            <DashboardPage />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
