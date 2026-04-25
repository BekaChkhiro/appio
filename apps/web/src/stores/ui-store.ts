import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarOpen: boolean;
  previewViewport: "mobile" | "tablet" | "desktop";
  setSidebarOpen: (open: boolean) => void;
  setPreviewViewport: (viewport: "mobile" | "tablet" | "desktop") => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      previewViewport: "mobile",
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setPreviewViewport: (viewport) => set({ previewViewport: viewport }),
    }),
    {
      name: "appio-ui",
    }
  )
);
