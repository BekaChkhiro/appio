import { StyleSheet } from "react-native-unistyles";

const lightTheme = {
  colors: {
    primary: "#6366f1",
    primaryLight: "#eef2ff",
    background: "#f9fafb",
    surface: "#ffffff",
    text: "#111827",
    textSecondary: "#6b7280",
    textTertiary: "#9ca3af",
    border: "#e5e7eb",
    borderLight: "#f3f4f6",
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },
  typography: {
    h1: { fontSize: 28, fontWeight: "700" as const },
    h2: { fontSize: 22, fontWeight: "700" as const },
    h3: { fontSize: 18, fontWeight: "600" as const },
    body: { fontSize: 15, fontWeight: "400" as const },
    bodySmall: { fontSize: 13, fontWeight: "400" as const },
    label: { fontSize: 14, fontWeight: "600" as const },
  },
} as const;

const darkTheme = {
  colors: {
    primary: "#818cf8",
    primaryLight: "#1e1b4b",
    background: "#111827",
    surface: "#1f2937",
    text: "#f9fafb",
    textSecondary: "#9ca3af",
    textTertiary: "#6b7280",
    border: "#374151",
    borderLight: "#1f2937",
    success: "#34d399",
    error: "#f87171",
    warning: "#fbbf24",
  },
  spacing: lightTheme.spacing,
  radius: lightTheme.radius,
  typography: lightTheme.typography,
} as const;

type AppThemes = {
  light: typeof lightTheme;
  dark: typeof darkTheme;
};

declare module "react-native-unistyles" {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  settings: {
    adaptiveThemes: true,
  },
});
