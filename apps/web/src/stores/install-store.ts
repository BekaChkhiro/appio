import { create } from "zustand";
import { persist } from "zustand/middleware";

interface InstallState {
  /** Number of successful generations in this session */
  generationCount: number;
  /** User dismissed the platform install banner */
  bannerDismissed: boolean;
  /** Timestamp of dismissal (to re-show after 7 days) */
  dismissedAt: number | null;

  incrementGenerations: () => void;
  dismissBanner: () => void;
  shouldShowBanner: () => boolean;
}

const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const useInstallStore = create<InstallState>()(
  persist(
    (set, get) => ({
      generationCount: 0,
      bannerDismissed: false,
      dismissedAt: null,

      incrementGenerations: () =>
        set((state) => ({ generationCount: state.generationCount + 1 })),

      dismissBanner: () =>
        set({ bannerDismissed: true, dismissedAt: Date.now() }),

      shouldShowBanner: () => {
        const { generationCount, bannerDismissed, dismissedAt } = get();
        // Need at least 1 successful generation
        if (generationCount < 1) return false;
        // If never dismissed, show it
        if (!bannerDismissed) return true;
        // Re-show after cooldown
        if (dismissedAt && Date.now() - dismissedAt > DISMISS_COOLDOWN_MS) {
          return true;
        }
        return false;
      },
    }),
    {
      name: "appio-install",
      partialize: (state) => ({
        generationCount: state.generationCount,
        bannerDismissed: state.bannerDismissed,
        dismissedAt: state.dismissedAt,
      }),
    }
  )
);
