"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, X } from "lucide-react";
import { Button } from "@appio/ui";
import { isCapacitor, isStandalone } from "@appio/config";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { useInstallStore } from "@/stores/install-store";
import { IOSInstallTooltip } from "./ios-install-tooltip";

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
}

export function InstallBanner() {
  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const { shouldShowBanner, dismissBanner } = useInstallStore();
  const [visible, setVisible] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Don't show for Capacitor or already-installed PWA users
    if (isCapacitor() || isStandalone() || installed) {
      setVisible(false);
      return;
    }

    setVisible(shouldShowBanner());
  }, [shouldShowBanner, installed]);

  if (!visible) return null;

  const isIOS = isIOSSafari();

  // On iOS, we can't use beforeinstallprompt — show instructional tooltip instead
  if (isIOS && !canInstall) {
    return (
      <>
        <AnimatePresence>
          {!showIOSGuide && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed bottom-20 left-4 right-4 z-50 md:bottom-6 md:left-auto md:right-6 md:w-80"
            >
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-lg">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Download className="h-4.5 w-4.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Install Appio</p>
                  <p className="text-xs text-muted-foreground">Add to Home Screen for the best experience</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setShowIOSGuide(true)}
                  >
                    How
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      dismissBanner();
                      setVisible(false);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <IOSInstallTooltip
          open={showIOSGuide}
          onClose={() => {
            setShowIOSGuide(false);
            dismissBanner();
            setVisible(false);
          }}
        />
      </>
    );
  }

  // Android / desktop — use native install prompt
  if (!canInstall) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="fixed bottom-20 left-4 right-4 z-50 md:bottom-6 md:left-auto md:right-6 md:w-80"
      >
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-lg">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Download className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Install Appio</p>
            <p className="text-xs text-muted-foreground">Get the full app experience</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="default"
              className="h-7 px-2.5 text-xs"
              onClick={async () => {
                // TODO: Track install attempt in PostHog when T3.5 is done
                const outcome = await promptInstall();
                if (outcome === "dismissed") {
                  dismissBanner();
                }
                // TODO: On "accepted", call POST /api/v1/apps/platform-install to record in DB
                setVisible(false);
              }}
            >
              Install
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                dismissBanner();
                setVisible(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
