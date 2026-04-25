"use client";

import { useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@appio/ui";
import { IOSInstallTooltip } from "./ios-install-tooltip";

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
}

interface AppInstallButtonProps {
  /** The public URL of the generated app (e.g., {app-id}.appiousercontent.com) */
  publicUrl: string;
}

/**
 * Install button for generated PWAs shown in the preview panel.
 * - Android/Chrome: opens the app URL in a new tab where beforeinstallprompt can fire
 * - iOS/Safari: shows instructional overlay for Add to Home Screen
 */
export function AppInstallButton({ publicUrl }: AppInstallButtonProps) {
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const handleInstall = () => {
    // TODO: Track generated app install attempt in PostHog when T3.5 is done
    // TODO: Call POST /api/v1/apps/{app-id}/install to update DB status
    if (isIOSSafari()) {
      setShowIOSGuide(true);
    } else {
      // Open in system browser so beforeinstallprompt can fire natively
      window.open(publicUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 px-2.5 text-xs"
        onClick={handleInstall}
        title="Install this app"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Install</span>
      </Button>

      <IOSInstallTooltip
        open={showIOSGuide}
        onClose={() => setShowIOSGuide(false)}
      />
    </>
  );
}
