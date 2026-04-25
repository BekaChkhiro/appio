import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { ObservabilityProvider } from "@/providers/observability-provider";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { TooltipProvider } from "@appio/ui";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Appio — Build Apps with Words",
    template: "%s | Appio",
  },
  description:
    "AI-powered PWA builder. Describe your app in natural language, get a production-ready PWA in seconds.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Appio",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a12" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&f[]=jetbrains-mono@400,500&display=swap"
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <ObservabilityProvider>
              <Suspense fallback={null}>
                <PageViewTracker />
              </Suspense>
              <QueryProvider>
                <TooltipProvider delayDuration={300}>
                  {children}
                </TooltipProvider>
              </QueryProvider>
            </ObservabilityProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
