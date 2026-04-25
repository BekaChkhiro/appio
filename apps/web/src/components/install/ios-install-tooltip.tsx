"use client";

import { motion, AnimatePresence } from "motion/react";
import { Share, Plus, X } from "lucide-react";
import { Button } from "@appio/ui";

interface IOSInstallTooltipProps {
  open: boolean;
  onClose: () => void;
}

export function IOSInstallTooltip({ open, onClose }: IOSInstallTooltipProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-card pb-safe"
          >
            <div className="p-6">
              {/* Handle */}
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/20" />

              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold text-foreground">
                  Install Appio
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Add Appio to your Home Screen for quick access and a full-screen experience.
              </p>

              {/* Steps */}
              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    1
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-2 pt-1">
                    <span className="text-sm text-foreground">
                      Tap the <strong>Share</strong> button
                    </span>
                    <Share className="h-4 w-4 shrink-0 text-primary" />
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    2
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-2 pt-1">
                    <span className="text-sm text-foreground">
                      Scroll down and tap <strong>Add to Home Screen</strong>
                    </span>
                    <Plus className="h-4 w-4 shrink-0 text-primary" />
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    3
                  </div>
                  <div className="pt-1">
                    <span className="text-sm text-foreground">
                      Tap <strong>Add</strong> to confirm
                    </span>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                className="mt-6 w-full"
                onClick={onClose}
              >
                Got it
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
