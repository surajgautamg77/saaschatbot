import create from 'zustand';
import { persist } from 'zustand/middleware';

interface BotStore {
  selectedBotId: string | null;
  setSelectedBotId: (botId: string | null) => void;
}

export const useBotStore = create<BotStore>()(
  persist(
    (set) => ({
      selectedBotId: null,
      setSelectedBotId: (botId) => set({ selectedBotId: botId }),
    }),
    {
      name: 'bot-storage', // name of the item in the storage (must be unique)
    }
  )
);