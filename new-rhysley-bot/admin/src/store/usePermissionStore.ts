
import create from 'zustand';
import { persist } from 'zustand/middleware';

interface PermissionState {
    soundEnabled: boolean;
    setSoundEnabled: (enabled: boolean) => void;
}

export const usePermissionStore = create(
    persist<PermissionState>(
        (set) => ({
            soundEnabled: false,
            setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
        }),
        {
            name: 'permission-storage', // unique name
        }
    )
);
