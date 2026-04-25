import { ReactNode, useEffect } from "react";
import { create } from "zustand";

interface ThemeStore {
  dark: boolean;
  toggle: () => void;
  setDark: (dark: boolean) => void;
}

const initialDark =
  typeof window !== "undefined" &&
  (localStorage.getItem("theme") === "dark" ||
    (localStorage.getItem("theme") === null &&
      window.matchMedia("(prefers-color-scheme: dark)").matches));

/**
 * Global dark-mode store. Use it from any component:
 *
 *   const dark = useTheme((s) => s.dark);
 *   const toggle = useTheme((s) => s.toggle);
 */
export const useTheme = create<ThemeStore>((set) => ({
  dark: initialDark,
  toggle: () =>
    set((s) => {
      const next = !s.dark;
      try {
        localStorage.setItem("theme", next ? "dark" : "light");
      } catch {}
      return { dark: next };
    }),
  setDark: (dark) => {
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {}
    set({ dark });
  },
}));

/**
 * Mounts the dark-mode class on <html>. Wrap your <Screen> in this once
 * at the top of App.tsx — children automatically get dark mode via
 * Tailwind's `dark:` variants.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const dark = useTheme((s) => s.dark);
  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [dark]);
  return <>{children}</>;
}
