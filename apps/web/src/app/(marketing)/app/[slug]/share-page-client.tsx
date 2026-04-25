"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Button, Card, CardContent } from "@appio/ui";
import { getUserContentDomain } from "@appio/config";
import {
  ExternalLink,
  Copy,
  Check,
  Share2,
  Download,
  QrCode,
  ArrowLeft,
} from "lucide-react";

interface PublicApp {
  name: string;
  slug: string;
  description: string | null;
  url: string | null;
  theme_color: string | null;
  install_count: number;
}

export function SharePageClient({ app }: { app: PublicApp }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const appUrl = app.url ?? `https://${app.slug}.${getUserContentDomain()}`;
  const themeColor = app.theme_color ?? "#7c3aed";

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleShare = useCallback(async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: app.name,
        text: app.description ?? `Check out ${app.name} — built with Appio`,
        url: window.location.href,
      });
    } catch {
      // User cancelled
    }
  }, [app.name, app.description]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Back to Appio */}
      <div className="mb-8 w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Appio
        </Link>
      </div>

      <Card className="w-full max-w-md overflow-hidden">
        {/* Theme color banner */}
        <div className="h-2 w-full" style={{ backgroundColor: themeColor }} />

        <CardContent className="p-6">
          {/* App icon + name */}
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg"
              style={{ backgroundColor: themeColor }}
            >
              {app.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold">{app.name}</h1>
              <p className="text-sm text-muted-foreground">
                {app.slug}.{getUserContentDomain()}
              </p>
            </div>
          </div>

          {/* Description */}
          {app.description && (
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              {app.description}
            </p>
          )}

          {/* Stats */}
          {app.install_count > 0 && (
            <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Download className="h-3.5 w-3.5" />
              {app.install_count} install
              {app.install_count !== 1 ? "s" : ""}
            </div>
          )}

          {/* Open app button */}
          <Button className="mt-6 w-full gap-2" size="lg" asChild>
            <a href={appUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open App
            </a>
          </Button>

          {/* Secondary actions */}
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied!" : "Copy link"}
            </Button>

            {typeof navigator !== "undefined" && "share" in navigator && (
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowQr((v) => !v)}
              className="shrink-0"
            >
              <QrCode className="h-4 w-4" />
            </Button>
          </div>

          {/* QR Code */}
          {showQr && (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border bg-white p-6">
              <QRCodeSVG
                value={appUrl}
                size={160}
                level="M"
                includeMargin={false}
              />
              <p className="text-xs text-gray-500">
                Scan to install on your device
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="mt-6 text-xs text-muted-foreground">
        Built with{" "}
        <Link href="/" className="underline hover:text-foreground">
          Appio
        </Link>{" "}
        — AI-powered PWA builder
      </p>
    </div>
  );
}
