"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, RefreshCw, Smartphone, Tablet, Minus, Plus as PlusIcon, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@appio/ui";
import { AppInstallButton } from "@/components/install/app-install-button";
import { PhoneFrame, PHONE_WIDTH, PHONE_HEIGHT } from "./phone-frame";
import { ThemeGeneratorPanel } from "./theme-generator-panel";

function isEmbeddablePreviewUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return (
      host.endsWith(".appiousercontent.com") || host === "appiousercontent.com"
    );
  } catch {
    return false;
  }
}

function withPreviewBypass(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("__appio_preview", "1");
    return u.toString();
  } catch {
    return url;
  }
}

interface PreviewPanelProps {
  previewUrl: string | null;
  publicUrl: string | null;
  isGenerating: boolean;
  previewVersion: number;
  appId?: string | null;
  // True when the backend is mid-generation but this tab is NOT the
  // active SSE stream (user navigated away and came back). Renders the
  // same skeleton as isGenerating so users see "still building".
  isBuildingOnBackend?: boolean;
}

export function PreviewPanel({
  previewUrl,
  publicUrl,
  isGenerating,
  previewVersion,
  appId,
  isBuildingOnBackend = false,
}: PreviewPanelProps) {
  const router = useRouter();
  const displayUrl = publicUrl ?? previewUrl;
  const showSkeleton = isGenerating || isBuildingOnBackend;
  const [iframeLoading, setIframeLoading] = useState(false);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [device, setDevice] = useState<"phone" | "tablet">("phone");
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const handleIframeLoad = useCallback(() => {
    setIframeLoading(false);
  }, []);

  const iframeKey = previewVersion;
  const prevVersionRef = useRef(previewVersion);

  useEffect(() => {
    if (previewVersion !== prevVersionRef.current && displayUrl) {
      setIframeLoading(true);
    }
    prevVersionRef.current = previewVersion;
  }, [previewVersion, displayUrl]);

  useEffect(() => {
    if (!iframeLoading) return;
    const id = setTimeout(() => setIframeLoading(false), 8000);
    return () => clearTimeout(id);
  }, [iframeLoading]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setContainerSize({ width: r.width, height: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const BEZEL = 10;
  const OUTER_W = PHONE_WIDTH + BEZEL * 2;
  const OUTER_H = PHONE_HEIGHT + BEZEL * 2;
  const PADDING = 32;
  const availW = Math.max(0, containerSize.width - PADDING * 2);
  const availH = Math.max(0, containerSize.height - PADDING * 2);
  const scaleByW = availW / OUTER_W;
  const scaleByH = availH / OUTER_H;
  const phoneScale = Math.max(0, Math.min(scaleByW, scaleByH, 1.1));

  const canEmbed = isEmbeddablePreviewUrl(displayUrl);

  const statusLabel = isGenerating
    ? "Building…"
    : displayUrl
    ? "Ready"
    : "Waiting";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Top toolbar ── */}
      <div
        className="flex shrink-0 items-center gap-2 px-3 py-2.5 sm:gap-2.5 sm:px-5"
        style={{ borderBottom: "1px solid var(--hair)" }}
      >
        {/* Device toggle */}
        <div
          className="flex gap-0.5 rounded-md p-0.5"
          style={{ background: "var(--surface-2)" }}
        >
          {(
            [
              ["phone", Smartphone],
              ["tablet", Tablet],
            ] as const
          ).map(([d, Icon]) => (
            <button
              key={d}
              type="button"
              onClick={() => setDevice(d)}
              className="flex h-8 w-8 items-center justify-center rounded transition-colors"
              style={{
                background:
                  device === d ? "var(--surface-0)" : "transparent",
                color:
                  device === d
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
              }}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>

        {/* Divider */}
        <div
          className="hidden h-4 w-px sm:block"
          style={{ background: "var(--hair)" }}
        />

        {/* Zoom */}
        <div className="hidden items-center gap-0.5 sm:flex">
          <button
            className="rounded p-1 transition-colors hover:bg-white/5"
            style={{ color: "var(--text-muted)" }}
            type="button"
          >
            <Minus size={14} />
          </button>
          <span
            className="min-w-[36px] text-center text-[12px] font-mono"
            style={{ color: "var(--text-muted)" }}
          >
            100%
          </span>
          <button
            className="rounded p-1 transition-colors hover:bg-white/5"
            style={{ color: "var(--text-muted)" }}
            type="button"
          >
            <PlusIcon size={14} />
          </button>
        </div>

        {/* Divider */}
        <div
          className="hidden h-4 w-px sm:block"
          style={{ background: "var(--hair)" }}
        />

        {/* Refresh */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
          style={{ color: "var(--text-muted)" }}
          type="button"
          onClick={() => {
            if (displayUrl) setIframeLoading(true);
          }}
        >
          <RefreshCw size={14} />
        </button>

        {/* Right side */}
        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2.5">
          {publicUrl && <AppInstallButton publicUrl={publicUrl} />}

          {displayUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-[12px] sm:h-7"
              onClick={() =>
                window.open(withPreviewBypass(displayUrl), "_blank")
              }
            >
              <ExternalLink size={13} />
              <span className="hidden sm:inline">Open</span>
            </Button>
          )}

          <Button
            size="sm"
            className="h-8 gap-1.5 px-3 text-[12px] sm:h-7 disabled:opacity-50"
            style={{ background: "var(--accent-token)" }}
            disabled={!appId || isGenerating}
            onClick={() => {
              if (appId) router.push(`/publish/${appId}`);
            }}
          >
            Publish
          </Button>
        </div>
      </div>

      {/* ── Canvas area ── */}
      <div
        ref={containerRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(124,92,255,0.04), transparent 50%),
                       linear-gradient(to right, var(--hair) 1px, transparent 1px) 0 0 / 32px 32px,
                       linear-gradient(to bottom, var(--hair) 1px, transparent 1px) 0 0 / 32px 32px`,
        }}
      >
        {displayUrl ? (
          <div className="flex flex-col items-center gap-5">
            <PhoneFrame scale={phoneScale}>
              {canEmbed ? (
                <iframe
                  key={iframeKey}
                  src={displayUrl + (displayUrl.includes("?") ? "&" : "?") + "preview=1"}
                  title="App preview"
                  className="border-0 bg-white"
                  style={{
                    width: PHONE_WIDTH,
                    height: PHONE_HEIGHT,
                    transform: `scale(${phoneScale})`,
                    transformOrigin: "top left",
                  }}
                  sandbox="allow-scripts allow-same-origin"
                  onLoad={handleIframeLoad}
                />
              ) : (
                <div
                  className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center"
                  style={{ background: "var(--surface-0)" }}
                >
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <ExternalLink
                      size={28}
                      style={{ color: "var(--accent-token)" }}
                    />
                  </div>
                  <div className="space-y-1">
                    <p
                      className="text-sm font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Your app is deployed
                    </p>
                    <p
                      className="max-w-xs text-xs leading-relaxed"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Preview couldn&apos;t be embedded. Open it in a new tab
                      to interact with the live app.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      window.open(withPreviewBypass(displayUrl), "_blank")
                    }
                  >
                    <ExternalLink size={14} />
                    Open app
                  </Button>
                </div>
              )}

              <AnimatePresence>
                {iframeLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      background: "rgba(11,11,15,0.6)",
                      backdropFilter: "blur(2px)",
                    }}
                  >
                    <div
                      className="flex items-center gap-2 rounded-lg px-3 py-2 shadow-md"
                      style={{
                        background: "var(--surface-1)",
                        border: "1px solid var(--hair)",
                      }}
                    >
                      <RefreshCw
                        size={14}
                        className="animate-spin"
                        style={{ color: "var(--accent-token)" }}
                      />
                      <span
                        className="text-xs font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Updating preview…
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </PhoneFrame>

            {/* Status chip */}
            <StatusChip label={statusLabel} />
          </div>
        ) : showSkeleton ? (
          <div className="flex flex-col items-center gap-5">
            <PhoneFrame scale={phoneScale}>
              <div
                className="flex h-full w-full flex-col gap-4 p-5 pt-16"
                style={{ background: "var(--surface-1)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 animate-pulse rounded-xl"
                    style={{ background: "var(--surface-2)" }}
                  />
                  <div className="flex-1 space-y-2">
                    <div
                      className="h-3 w-24 animate-pulse rounded"
                      style={{ background: "var(--surface-2)" }}
                    />
                    <div
                      className="h-2.5 w-16 animate-pulse rounded"
                      style={{ background: "var(--surface-3)" }}
                    />
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div
                    className="h-3 w-full animate-pulse rounded"
                    style={{ background: "var(--surface-2)" }}
                  />
                  <div
                    className="h-3 w-5/6 animate-pulse rounded"
                    style={{ background: "var(--surface-2)" }}
                  />
                  <div
                    className="h-3 w-3/4 animate-pulse rounded"
                    style={{ background: "var(--surface-2)" }}
                  />
                </div>
                <div
                  className="h-32 w-full animate-pulse rounded-xl"
                  style={{ background: "var(--surface-2)" }}
                />
                <div className="flex gap-2 pt-1">
                  <div
                    className="h-9 flex-1 animate-pulse rounded-lg"
                    style={{ background: "rgba(124,92,255,0.15)" }}
                  />
                  <div
                    className="h-9 w-20 animate-pulse rounded-lg"
                    style={{ background: "var(--surface-2)" }}
                  />
                </div>
                <p
                  className="mt-auto text-center text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Building your app…
                </p>
              </div>
            </PhoneFrame>
            <StatusChip
              label={
                isBuildingOnBackend && !isGenerating
                  ? "Still building on server…"
                  : "Building…"
              }
            />
          </div>
        ) : (
          <div className="z-10 flex flex-col items-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed"
              style={{
                borderColor: "var(--hair)",
                background: "var(--surface-1)",
              }}
            >
              <Loader2
                size={20}
                style={{ color: "var(--text-subtle)" }}
              />
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Preview will appear here
            </p>
          </div>
        )}
      </div>

      <ThemeGeneratorPanel open={themeSheetOpen} onOpenChange={setThemeSheetOpen} />
    </div>
  );
}

function StatusChip({ label }: { label: string }) {
  const color =
    label === "Building…"
      ? "var(--accent-token)"
      : label === "Ready"
      ? "#22c55e"
      : "var(--text-muted)";
  return (
    <div
      className="flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--hair)",
        color: color,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </div>
  );
}
