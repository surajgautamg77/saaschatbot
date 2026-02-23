
import create from 'zustand';

interface SoundState {
    ringingSessionId: string | null;
    setRingingSessionId: (sessionId: string | null) => void;
}

export const useSoundStore = create<SoundState>((set) => ({
    ringingSessionId: null,
    setRingingSessionId: (sessionId) => set({ ringingSessionId: sessionId }),
}));
