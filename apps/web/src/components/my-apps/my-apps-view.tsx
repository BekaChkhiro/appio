"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@appio/ui";
import { Plus, Search, MoreVertical, Sparkles, ArrowRight } from "lucide-react";
import { useMyApps } from "@appio/api-client";
import type { App } from "@appio/api-client";

// ---------- Relative time formatter ----------
function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------- Status chip ----------
function StatusChip({ status }: { status: App["status"] }) {
  const configs: Record<App["status"], { bg: string; color: string; label: string }> = {
    draft: { bg: "var(--surface-2)", color: "var(--text-muted)", label: "Draft" },
    building: { bg: "var(--accent-soft)", color: "var(--accent-token)", label: "Building" },
    ready: { bg: "var(--success-soft)", color: "var(--success)", label: "Ready" },
    published: { bg: "var(--success-soft)", color: "var(--success)", label: "Published" },
    failed: { bg: "var(--danger-soft)", color: "var(--danger)", label: "Failed" },
  };
  const c = configs[status] || configs.draft;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: c.bg,
        color: c.color,
        padding: "0 8px",
        height: 22,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "-0.005em",
        whiteSpace: "nowrap",
      }}
    >
      {c.label}
    </span>
  );
}

// ---------- Skeleton card ----------
function SkeletonCard() {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--hair)",
        borderRadius: "var(--r-card, 10px)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          aspectRatio: "4/4.2",
          background: "linear-gradient(90deg, var(--surface-2), var(--surface-3), var(--surface-2))",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.6s infinite",
        }}
      />
      <div style={{ padding: 14 }}>
        <div
          style={{
            height: 12,
            width: "60%",
            background: "linear-gradient(90deg, var(--surface-2), var(--surface-3), var(--surface-2))",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.6s infinite",
            borderRadius: 4,
            marginBottom: 10,
          }}
        />
        <div
          style={{
            height: 10,
            width: "40%",
            background: "linear-gradient(90deg, var(--surface-2), var(--surface-3), var(--surface-2))",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.6s infinite",
            borderRadius: 4,
          }}
        />
      </div>

    </div>
  );
}

// ---------- New app tile ----------
function NewAppTile() {
  return (
    <Link href="/create" className="block" style={{ textDecoration: "none" }}>
      <div
        className="flex min-h-[88px] items-center gap-3 rounded-xl p-3 sm:hidden"
        style={{
          background: "var(--surface-1)",
          border: "1.5px dashed var(--strong)",
        }}
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}
        >
          <Plus className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
            New app
          </div>
          <div className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
            Start from a sentence
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} />
      </div>
      <div
        className="hidden sm:flex"
        style={{
          background: "var(--surface-0)",
          border: "1.5px dashed var(--strong)",
          borderRadius: "var(--r-card, 10px)",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          cursor: "pointer",
          aspectRatio: "4/5.2",
          transition: "border-color 120ms, background 120ms",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--accent-token)";
          e.currentTarget.style.background = "var(--accent-soft)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--strong)";
          e.currentTarget.style.background = "var(--surface-0)";
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "var(--surface-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-primary)",
            marginBottom: 14,
          }}
        >
          <Plus className="h-5 w-5" />
        </div>
        <div className="t-h4" style={{ color: "var(--text-primary)" }}>New app</div>
        <div className="t-caption" style={{ marginTop: 4 }}>Start from a sentence</div>
      </div>
    </Link>
  );
}

// ---------- App card ----------
function AppCard({ app }: { app: App }) {
  const edited = formatRelativeTime(app.updated_at);
  const tint = app.theme_color || "#7C5CFF";

  return (
    <Link href={`/build?app=${app.id}`} className="block" style={{ textDecoration: "none" }}>
      <div
        className="flex min-h-[92px] items-center gap-3 rounded-xl p-3 sm:hidden"
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--hair)",
        }}
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white"
          style={{ background: tint }}
        >
          {app.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
            {app.name}
          </div>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <StatusChip status={app.status} />
            <span className="truncate text-[12px]" style={{ color: "var(--text-muted)" }}>
              Edited {edited}
            </span>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} />
      </div>
      <div
        className="hidden sm:block"
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--hair)",
          borderRadius: "var(--r-card, 10px)",
          overflow: "hidden",
          cursor: "pointer",
          transition: "border-color 120ms",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--strong)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--hair)";
        }}
      >
        <div
          style={{
            aspectRatio: "4/4.2",
            background: `linear-gradient(160deg, ${tint}15, var(--surface-0))`,
            borderBottom: "1px solid var(--hair)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: tint,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 22,
              fontWeight: 700,
              boxShadow: "0 8px 24px -8px rgba(0,0,0,0.5)",
            }}
          >
            {app.name.charAt(0).toUpperCase()}
          </div>
        </div>
        <div style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="t-h4" style={{ color: "var(--text-primary)" }}>{app.name}</div>
            <MoreVertical className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 8,
            }}
          >
            <span className="t-caption">Edited {edited}</span>
            <StatusChip status={app.status} />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------- Empty state ----------
function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center px-3 py-14 sm:p-12">
      <div style={{ textAlign: "center", maxWidth: 560 }}>
        <div
          style={{
            width: 72,
            height: 72,
            margin: "0 auto 28px",
            borderRadius: 20,
            background: "var(--accent-soft)",
            color: "var(--accent-token)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkles className="h-8 w-8" />
        </div>
        <div className="t-display" style={{ marginBottom: 16, color: "var(--text-primary)" }}>
          Your first app is one sentence away.
        </div>
        <div className="t-body-lg muted" style={{ marginBottom: 32 }}>
          What do you want to build? A habit tracker. A wedding RSVP. A dashboard for your bakery. Anything you can describe, Appio can make.
        </div>
        <div className="flex justify-center gap-3">
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href="/build" className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Start from scratch
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MyAppsView() {
  const { data, isLoading, error } = useMyApps();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [search]);

  const apps = useMemo(() => data?.items ?? [], [data?.items]);

  const filtered = useMemo(() => {
    let result = apps;
    if (filter !== "all") {
      result = result.filter((a) => a.status === filter);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((a) => a.name.toLowerCase().includes(q));
    }
    return result;
  }, [apps, filter, debouncedSearch]);

  const counts = useMemo(() => {
    const all = apps.length;
    const draft = apps.filter((a) => a.status === "draft").length;
    const building = apps.filter((a) => a.status === "building").length;
    const ready = apps.filter((a) => a.status === "ready").length;
    const published = apps.filter((a) => a.status === "published").length;
    const failed = apps.filter((a) => a.status === "failed").length;
    return { all, draft, building, ready, published, failed };
  }, [apps]);

  return (
    <div
      className="scroll mobile-page-scroll"
      style={{
        height: "100%",
        overflow: "auto",
        background: "var(--surface-0)",
      }}
    >
      <div
        className="px-4 pb-6 pt-5 sm:px-12 sm:py-8 lg:px-16"
        style={{ maxWidth: 1440, margin: "0 auto", width: "100%" }}
      >
        <div
          className="mb-6 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <div className="t-overline" style={{ marginBottom: 8 }}>
              {isLoading ? "Loading…" : `${counts.all} project${counts.all !== 1 ? "s" : ""}`}
            </div>
            <div className="t-display" style={{ color: "var(--text-primary)" }}>Your apps</div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <div
              className="w-full sm:w-60"
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "var(--surface-1)",
                border: "1px solid var(--hair)",
                borderRadius: "var(--r-input, 6px)",
                padding: "0 10px",
                height: 36,
                gap: 8,
              }}
            >
              <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <input
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  fontFamily: "var(--font-sans)",
                }}
              />
            </div>
            <Button size="sm" asChild className="inline-flex h-10 w-full items-center gap-1.5 sm:w-auto">
              <Link href="/create">
                <Plus className="h-3.5 w-3.5" />
                New app
              </Link>
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: 20,
              background: "var(--danger-soft)",
              border: "1px solid rgba(244,63,94,0.24)",
              borderRadius: 10,
              marginBottom: 24,
              color: "var(--danger)",
              fontSize: 14,
            }}
          >
            Failed to load apps. Please try again.
          </div>
        )}

        {/* Filter tabs */}
        {!isLoading && !error && apps.length > 0 && (
          <div
            className="no-scrollbar -mx-4 mb-5 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:mb-8 sm:px-0"
            style={{
              borderBottom: "1px solid var(--hair)",
            }}
          >
            {(
              [
                ["all", "All"],
                ["draft", "Drafts"],
                ["building", "Building"],
                ["ready", "Ready"],
                ["published", "Published"],
                ["failed", "Failed"],
              ] as const
            ).map(([k, l]) => (
              <button
                type="button"
                key={k}
                onClick={() => setFilter(k)}
                style={{
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: filter === k ? "var(--text-primary)" : "var(--text-muted)",
                  borderBottom: filter === k ? "2px solid var(--accent-token)" : "2px solid transparent",
                  marginBottom: -1,
                  cursor: "pointer",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {l}{" "}
                <span style={{ color: "var(--text-subtle)", marginLeft: 4 }}>
                  {counts[k as keyof typeof counts]}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            <NewAppTile />
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : apps.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 0", color: "var(--text-muted)" }}>
            <div className="t-h3" style={{ marginBottom: 8 }}>No results</div>
            <div className="t-body muted">Nothing matched your search. Try another word.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            <NewAppTile />
            {filtered.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
