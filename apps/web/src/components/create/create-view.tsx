"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { MessageSquare, Eye } from "lucide-react";
import { useGeneration, useAppTemplateDetail, useApp, useUpdateAppMessages } from "@appio/api-client";
import { useAuth } from "@appio/auth";
import { useChatStore } from "@/stores/chat-store";
import { useInstallStore } from "@/stores/install-store";
import { EditorSidebar } from "./editor-sidebar";
import { ChatPanel } from "./chat-panel";
import { PreviewPanel } from "./preview-panel";
import { InstallBanner } from "@/components/install/install-banner";

type MobileTab = "chat" | "preview";

const PENDING_PROMPT_PREFIX = "appio_pending_prompt_";

export function CreateView() {
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const searchParams = useSearchParams();
  const templateSlug = searchParams.get("template");
  const editAppId = searchParams.get("app");
  const buildId = searchParams.get("b");
  // Legacy fallback: `?prompt=` was the pre-build-id URL scheme. Still honored
  // so old browser history / external links don't 404.
  const legacyPromptParam = searchParams.get("prompt");
  const [stashedPrompt] = useState<string | null>(() => {
    if (typeof window === "undefined" || !buildId) return null;
    const key = PENDING_PROMPT_PREFIX + buildId;
    const value = sessionStorage.getItem(key);
    if (value) sessionStorage.removeItem(key);
    return value;
  });
  const promptParam = stashedPrompt ?? legacyPromptParam;
  const templateHandledRef = useRef(false);
  const lastLoadedAppIdRef = useRef<string | null>(null);

  const { addMessage, messages, clearMessages, setMessages } = useChatStore();
  const { incrementGenerations } = useInstallStore();
  const { getIdToken } = useAuth();

  const getToken = useCallback(() => getIdToken(), [getIdToken]);

  const {
    generate,
    cancel,
    events,
    previewUrl,
    previewVersion,
    publicUrl,
    isGenerating,
    status,
  } = useGeneration({ getToken });

  const { data: templateDetail, error: templateError } =
    useAppTemplateDetail(templateSlug);

  const { data: editApp } = useApp(editAppId);
  const updateMessages = useUpdateAppMessages(editAppId);

  // Load chat history when entering edit mode for an existing app
  useEffect(() => {
    if (!editAppId) {
      lastLoadedAppIdRef.current = null;
      return;
    }
    if (editAppId !== lastLoadedAppIdRef.current && editApp) {
      lastLoadedAppIdRef.current = editAppId;
      setMessages(editApp.messages || []);
    }
  }, [editAppId, editApp, setMessages]);

  // Auto-save messages to backend (debounced 1s)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!editAppId || messages.length === 0) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateMessages.mutate(messages);
    }, 1000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [messages, editAppId, updateMessages]);

  // Auto-trigger generation from prompt param (new project modal)
  useEffect(() => {
    if (
      promptParam &&
      !templateHandledRef.current &&
      messages.length === 0 &&
      !isGenerating &&
      !editAppId
    ) {
      templateHandledRef.current = true;
      addMessage({ role: "user", content: promptParam });
      generate(promptParam);
    }
  }, [promptParam, messages.length, isGenerating, addMessage, generate, editAppId]);

  // Auto-trigger generation from template canonical prompt
  useEffect(() => {
    if (
      templateDetail?.canonical_prompt &&
      !templateHandledRef.current &&
      messages.length === 0 &&
      !isGenerating
    ) {
      templateHandledRef.current = true;
      addMessage({ role: "user", content: templateDetail.canonical_prompt });
      generate(templateDetail.canonical_prompt, {
        templateSlug: templateDetail.slug,
      });
    }
  }, [templateDetail, messages.length, isGenerating, addMessage, generate]);

  useEffect(() => {
    if (templateError && templateSlug && !templateHandledRef.current) {
      templateHandledRef.current = true;
      addMessage({
        role: "assistant",
        content:
          "Failed to load the template. You can describe your app idea below instead.",
      });
    }
  }, [templateError, templateSlug, addMessage]);

  const handleGenerate = useCallback(
    (prompt: string) => {
      generate(prompt, editAppId ? { appId: editAppId } : {});
    },
    [generate, editAppId]
  );

  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current === "generating" && status === "complete") {
      const lastComplete = events.findLast((e) => e.type === "complete");
      if (lastComplete) {
        const data = lastComplete.data as {
          public_url: string;
          tokens?: { cost_usd?: number };
        };
        // Encoded as a marker so ChatMessage can render a rich card.
        // The `__APP_READY__` prefix is inert in plain-text fallback paths
        // (mobile install messages, etc.) but gets parsed into structured
        // props by chat-message.tsx.
        addMessage({
          role: "assistant",
          content:
            "__APP_READY__" +
            JSON.stringify({
              url: data.public_url,
              cost_usd: data.tokens?.cost_usd ?? null,
            }),
        });
        incrementGenerations();
        // Auto-switch mobile view to the preview so the user lands on the
        // live app instead of the tool-call log.
        setMobileTab("preview");
      }
    }
    if (prevStatusRef.current === "generating" && status === "error") {
      const lastError = events.findLast((e) => e.type === "error");
      const errMessage =
        (lastError?.data as { message?: string } | undefined)?.message ??
        "The generation stream ended unexpectedly.";
      addMessage({
        role: "assistant",
        content: `Something went wrong: ${errMessage}\n\nPlease try again or modify your description.`,
      });
    }
    prevStatusRef.current = status;
  }, [status, events, addMessage, incrementGenerations]);

  const prevPreviewVersionRef = useRef(0);
  useEffect(() => {
    if (previewVersion > 0 && prevPreviewVersionRef.current === 0) {
      setMobileTab("preview");
    }
    prevPreviewVersionRef.current = previewVersion;
  }, [previewVersion]);

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--surface-0)" }}>
      {/* ── Mobile tab bar ── */}
      <div
        className="flex shrink-0 items-center md:hidden"
        style={{ borderBottom: "1px solid var(--hair)", background: "var(--surface-0)" }}
      >
        {(["chat", "preview"] as const).map((tab) => {
          const isActive = mobileTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className="relative flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors"
              style={{
                color: isActive ? "var(--accent-token)" : "var(--text-muted)",
              }}
            >
              {tab === "chat" ? <MessageSquare size={18} /> : <Eye size={18} />}
              <span className="capitalize">{tab}</span>
              {tab === "preview" && previewUrl && !isActive && (
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent-token)" }} />
              )}
              {isActive && (
                <motion.div
                  layoutId="mobile-tab-active"
                  className="absolute bottom-0 left-4 right-4 h-[2.5px] rounded-full"
                  style={{ background: "var(--accent-token)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content area ── */}
      <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
        {/* Desktop: 3-column layout */}
        <div className="hidden h-full w-full md:flex">
          {/* LEFT — Editor sidebar */}
          <div
            className="flex shrink-0 flex-col border-r"
            style={{ width: 260, borderColor: "var(--hair)", background: "var(--surface-0)" }}
          >
            <EditorSidebar
              appName={editApp?.name ?? null}
              appStatus={editApp?.status ?? null}
            />
          </div>

          {/* CENTER — Preview canvas */}
          <div className="flex min-h-0 flex-1 flex-col" style={{ background: "var(--surface-0)" }}>
            <PreviewPanel
              previewUrl={previewUrl ?? editApp?.url ?? null}
              publicUrl={publicUrl ?? editApp?.url ?? null}
              isGenerating={isGenerating}
              previewVersion={previewVersion}
            />
          </div>

          {/* RIGHT — Chat panel */}
          <div
            className="flex shrink-0 flex-col border-l"
            style={{ width: 420, borderColor: "var(--hair)", background: "var(--surface-0)" }}
          >
            <ChatPanel
              events={events}
              isGenerating={isGenerating}
              onGenerate={handleGenerate}
              onCancel={cancel}
              editingAppName={editApp?.name ?? null}
            />
          </div>
        </div>

        {/* Mobile: single full-width panel */}
        <div className="flex h-full w-full flex-col md:hidden">
          {mobileTab === "chat" ? (
            <ChatPanel
              events={events}
              isGenerating={isGenerating}
              onGenerate={handleGenerate}
              onCancel={cancel}
              editingAppName={editApp?.name ?? null}
            />
          ) : (
            <PreviewPanel
              previewUrl={previewUrl ?? editApp?.url ?? null}
              publicUrl={publicUrl ?? editApp?.url ?? null}
              isGenerating={isGenerating}
              previewVersion={previewVersion}
            />
          )}
        </div>
      </div>

      <InstallBanner />
    </div>
  );
}
