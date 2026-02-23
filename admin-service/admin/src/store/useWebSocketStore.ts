
import create from 'zustand';

interface WebSocketState {
    lastMessage: any | null;
    setLastMessage: (message: any | null) => void;
}

export const useWebSocketStore = create<WebSocketState>((set) => ({
    lastMessage: null,
    setLastMessage: (message) => set({ lastMessage: message }),
}));
