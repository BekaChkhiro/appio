"use client";

import { useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
} from "@appio/ui";
import type { App } from "@appio/api-client";
import { getAppBaseUrl } from "@appio/config";
import {
  Copy,
  Check,
  Share2,
  ExternalLink,
  QrCode,
  Link2,
} from "lucide-react";

interface ShareDialogProps {
  app: App;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ app, open, onOpenChange }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const shareUrl = `${getAppBaseUrl()}/app/${app.slug}`;
  const appUrl = app.url ?? "";

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  const handleNativeShare = useCallback(async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: app.name,
        text: app.description ?? `Check out ${app.name} — built with Appio`,
        url: shareUrl,
      });
    } catch {
      // User cancelled or share failed — ignore
    }
  }, [app.name, app.description, shareUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share &ldquo;{app.name}&rdquo;
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Share link */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Share link
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm truncate">
                {shareUrl}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {typeof navigator !== "undefined" && "share" in navigator && (
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={handleNativeShare}
              >
                <Share2 className="h-4 w-4" />
                Share via...
              </Button>
            )}

            {appUrl && (
              <Button
                variant="outline"
                className="justify-start gap-2"
                asChild
              >
                <a href={appUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open app directly
                </a>
              </Button>
            )}

            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => setShowQr((v) => !v)}
            >
              <QrCode className="h-4 w-4" />
              {showQr ? "Hide QR code" : "Show QR code"}
            </Button>
          </div>

          {/* QR Code */}
          {showQr && (
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-white p-6">
              <QRCodeSVG
                value={shareUrl}
                size={180}
                level="M"
                includeMargin={false}
              />
              <p className="text-xs text-muted-foreground">
                Scan to open on another device
              </p>
            </div>
          )}

          {/* Direct link */}
          {appUrl && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Direct PWA link
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate">
                  {appUrl}
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
