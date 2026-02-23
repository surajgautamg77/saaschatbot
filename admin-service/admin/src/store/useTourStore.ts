import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type TourId = 'onboarding' | null;

interface TourState {
  activeTour: TourId;
  stepIndex: number;
  run: boolean;

  // Actions
  startTour: (tourId: TourId) => void;
  stopTour: () => void;
  setStepIndex: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  resumeTour: () => void;
}

export const useTourStore = create<TourState>()(
  persist(
    (set) => ({
      activeTour: null,
      stepIndex: 0,
      run: false,

      startTour: (tourId) => {
        // If starting a fresh tour, reset index to 0
        set({ activeTour: tourId, run: true, stepIndex: 0 });
      },
      stopTour: () => set({ run: false, activeTour: null }),
      setStepIndex: (index) => set({ stepIndex: index }),
      nextStep: () => set((state) => ({ stepIndex: state.stepIndex + 1 })),
      prevStep: () => set((state) => ({ stepIndex: state.stepIndex - 1 })),
      resumeTour: () => set({ run: true }),
    }),
    {
      name: 'rhysley-tour-state',
      storage: createJSONStorage(() => localStorage),
      // Only persist onboarding state. Contextual tours should reset on refresh.
      partialize: (state) => ({
        activeTour: state.activeTour, // activeTour can only be 'onboarding' or null now
        stepIndex: state.activeTour === 'onboarding' ? state.stepIndex : 0,
        // We don't persist 'run' as true to prevent auto-popping on reload if the user was away
        run: false
      }),
    }
  )
);