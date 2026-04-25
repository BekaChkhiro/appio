"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Flame, Github, Trash2, ExternalLink } from "lucide-react";
import { Button, Input } from "@appio/ui";
import { useApp, useDeleteApp } from "@appio/api-client";

const TABS = [
  { id: "builder", label: "Builder", href: (id: string) => `/build?app=${id}` },
  { id: "analytics", label: "Analytics", href: () => `#` },
  { id: "versions", label: "Versions", href: () => `#` },
  { id: "settings", label: "Settings", href: (id: string) => `/apps/${id}/settings` },
];

const STATUS_CHIP: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "var(--text-muted)", bg: "var(--surface-2)" },
  building: { label: "Building", color: "var(--accent-token)", bg: "var(--accent-soft)" },
  ready: { label: "Ready", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  published: { label: "Published", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  failed: { label: "Failed", color: "#f43f5e", bg: "rgba(244,63,94,0.12)" },
};

interface AppSettingsViewProps {
  appId: string;
}

export function AppSettingsView({ appId }: AppSettingsViewProps) {
  const router = useRouter();
  const { data: app, isLoading } = useApp(appId);
  const deleteApp = useDeleteApp();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const status = STATUS_CHIP[app?.status ?? "draft"];

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: "var(--surface-0)" }}>
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: "var(--surface-0)" }}>
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>App not found.</div>
      </div>
    );
  }

  const handleDelete = () => {
    deleteApp.mutate(appId, {
      onSuccess: () => router.push("/my-apps"),
    });
  };

  return (
    <div className="scroll flex h-full flex-col overflow-auto" style={{ background: "var(--surface-0)" }}>
      {/* Sub-nav */}
      <div
        className="app-settings-subnav flex shrink-0 items-center gap-2 px-6"
        style={{ borderBottom: "1px solid var(--hair)", background: "var(--surface-0)" }}
      >
        <Link
          href="/my-apps"
          className="flex items-center gap-1.5 rounded p-1 text-[13px] transition-colors hover:bg-white/5"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronLeft size={14} />
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{app.name}</span>
        </Link>

        <div
          className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ background: status.bg, color: status.color, border: `1px solid ${status.color}20` }}
        >
          {status.label}
        </div>

        <div className="ml-6 hidden gap-0 sm:flex">
          {TABS.map((t) => {
            const isActive = t.id === "settings";
            return (
              <Link
                key={t.id}
                href={t.href(appId)}
                className="px-3.5 py-3 text-[13px] font-medium transition-colors"
                style={{
                  color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                  borderBottom: isActive ? "2px solid var(--accent-token)" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto hidden sm:block">
          {app.url && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-[12px]"
              onClick={() => window.open(app.url!, "_blank")}
            >
              <ExternalLink size={13} />
              Open app
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        className="app-settings-content px-6 py-8 sm:px-12 lg:px-16"
        style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}
      >
        <div className="t-display" style={{ marginBottom: 28, color: "var(--text-primary)" }}>
          App settings
        </div>

        {/* General */}
        <SettingGroup label="General">
          <SettingRow label="Name">
            <Input defaultValue={app.name} style={{ maxWidth: 260 }} />
          </SettingRow>
          <SettingRow label="Icon">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-lg text-white"
                style={{ background: app.theme_color ?? "var(--accent-token)" }}
              >
                <Flame size={22} />
              </div>
              <Button variant="secondary" size="sm">Change</Button>
            </div>
          </SettingRow>
          <SettingRow label="Description">
            <Input defaultValue={app.description ?? ""} placeholder="A short description…" style={{ maxWidth: 320 }} />
          </SettingRow>
        </SettingGroup>

        {/* Domain */}
        <SettingGroup label="Domain">
          <SettingRow label="Appio URL">
            <span className="t-mono" style={{ color: "var(--text-primary)", fontSize: 13 }}>
              {app.slug}.appio.app
            </span>
          </SettingRow>
          <SettingRow label="Custom domain">
            <div>
              <Button variant="secondary" size="sm" disabled>
                Add custom domain
              </Button>
              <div className="t-caption" style={{ marginTop: 6, color: "var(--text-muted)" }}>
                Coming soon · Creator plan and up
              </div>
            </div>
          </SettingRow>
        </SettingGroup>

        {/* Data */}
        <SettingGroup label="Data">
          <SettingRow label="Convex project">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: "var(--accent-token)" }}
              />
              <span className="font-mono text-[13px]" style={{ color: "var(--text-primary)" }}>
                {app.slug}-prod
              </span>
              <div
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}
              >
                Connected
              </div>
            </div>
          </SettingRow>
          <SettingRow label="Export code">
            <Button variant="secondary" size="sm" className="gap-1.5">
              <Github size={14} />
              Push to GitHub
            </Button>
          </SettingRow>
        </SettingGroup>

        {/* Danger zone */}
        <div
          className="mt-10 rounded-xl p-6"
          style={{
            border: "1px solid rgba(244,63,94,0.24)",
            background: "var(--danger-soft, rgba(244,63,94,0.08))",
          }}
        >
          <div className="t-h3" style={{ color: "var(--danger, #f43f5e)", marginBottom: 6 }}>
            Danger zone
          </div>
          <div className="t-caption" style={{ marginBottom: 20, color: "var(--text-muted)" }}>
            These actions can&apos;t be undone.
          </div>

          <div
            className="danger-row flex items-center justify-between py-3"
            style={{ borderTop: "1px solid rgba(244,63,94,0.2)" }}
          >
            <div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                Unpublish app
              </div>
              <div className="t-caption">Takes the URL offline · Data stays in your Convex.</div>
            </div>
            <Button variant="outline" size="sm">
              Unpublish
            </Button>
          </div>

          <div
            className="danger-row flex items-center justify-between py-3"
            style={{ borderTop: "1px solid rgba(244,63,94,0.2)" }}
          >
            <div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                Delete app
              </div>
              <div className="t-caption">Removes from Appio · You decide about Convex data.</div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleteApp.isPending}
            >
              <Trash2 size={14} />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(11,11,15,0.72)", backdropFilter: "blur(10px)" }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-xl p-6"
            style={{ background: "var(--surface-1)", border: "1px solid var(--strong)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="t-h3" style={{ color: "var(--text-primary)", marginBottom: 8 }}>
              Delete &ldquo;{app.name}&rdquo;?
            </div>
            <div className="t-body" style={{ color: "var(--text-muted)", marginBottom: 24 }}>
              This will permanently delete this app and all its versions. This action cannot be undone.
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteApp.isPending}
              >
                {deleteApp.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ marginBottom: 12, color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className="overflow-hidden rounded-xl"
        style={{ background: "var(--surface-1)", border: "1px solid var(--hair)" }}
      >
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="app-setting-row flex items-center gap-4 px-5 py-4"
      style={{ borderBottom: "1px solid var(--hair)" }}
    >
      <div
        className="app-setting-label w-[140px] shrink-0 text-[13px]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div className="app-setting-value flex-1">{children}</div>
    </div>
  );
}
