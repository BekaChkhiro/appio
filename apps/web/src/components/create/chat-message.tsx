"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ExternalLink, Copy, Check, PartyPopper } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { ChatMessage as ChatMessageType } from "@/stores/chat-store";

interface ChatMessageProps {
  message: ChatMessageType;
  index: number;
}

interface AppReadyPayload {
  url: string;
  cost_usd: number | null;
}

const APP_READY_PREFIX = "__APP_READY__";

function parseAppReady(content: string): AppReadyPayload | null {
  if (!content.startsWith(APP_READY_PREFIX)) return null;
  try {
    const parsed = JSON.parse(content.slice(APP_READY_PREFIX.length));
    if (typeof parsed?.url !== "string") return null;
    return {
      url: parsed.url,
      cost_usd: typeof parsed.cost_usd === "number" ? parsed.cost_usd : null,
    };
  } catch {
    return null;
  }
}

function AppReadyCard({ payload }: { payload: AppReadyPayload }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — silently no-op */
    }
  };

  return (
    <div
      className="w-full max-w-[92%] overflow-hidden rounded-xl"
      style={{
        background:
          "linear-gradient(145deg, var(--accent-soft) 0%, var(--surface-1) 65%)",
        border: "1px solid var(--accent-token)",
      }}
    >
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <PartyPopper size={16} style={{ color: "var(--accent-token)" }} />
        <span
          className="text-[13px] font-semibold"
          style={{ color: "var(--accent-token)" }}
        >
          App ready
        </span>
      </div>
      <div className="flex gap-3 px-4 pb-4 pt-2">
        <div className="min-w-0 flex-1">
          <div
            className="mb-3 truncate rounded-md px-3 py-2 font-mono text-[11.5px]"
            style={{
              background: "var(--surface-2)",
              color: "var(--text-primary)",
              border: "1px solid var(--hair)",
            }}
            title={payload.url}
          >
            {payload.url.replace(/^https?:\/\//, "")}
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={payload.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-opacity hover:opacity-90"
              style={{
                background: "var(--accent-token)",
                color: "var(--accent-soft-contrast, #fff)",
              }}
            >
              <ExternalLink size={13} />
              Open app
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors"
              style={{
                background: "var(--surface-2)",
                color: "var(--text-primary)",
                border: "1px solid var(--hair)",
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy URL"}
            </button>
            {payload.cost_usd !== null && (
              <span
                className="ml-auto inline-flex items-center text-[11.5px]"
                style={{ color: "var(--text-muted)" }}
              >
                Cost: ${payload.cost_usd.toFixed(2)}
              </span>
            )}
          </div>
        </div>
        {/* Scan-to-phone QR — lets the user pop the PWA on their device
            without copy-pasting the URL. White inner padding keeps the
            modules readable against the gradient background. */}
        <a
          href={payload.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center justify-center rounded-md transition-transform hover:scale-[1.03]"
          style={{
            background: "#fff",
            padding: 6,
            height: 96,
            width: 96,
          }}
          title="Scan to open on phone"
          aria-label="Scan QR code to open the app on your phone"
        >
          <QRCodeSVG
            value={payload.url}
            size={84}
            level="M"
            marginSize={0}
          />
        </a>
      </div>
    </div>
  );
}

export function ChatMessage({ message, index }: ChatMessageProps) {
  const isUser = message.role === "user";
  const appReady = !isUser ? parseAppReady(message.content) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      className="flex flex-col"
      style={{ alignItems: isUser ? "flex-end" : "flex-start" }}
    >
      {isUser ? (
        <div
          className="max-w-[85%] rounded-xl px-4 py-2.5 text-[14px] leading-relaxed"
          style={{
            background: "var(--surface-2)",
            color: "var(--text-primary)",
            border: "1px solid var(--strong)",
          }}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      ) : appReady ? (
        <AppReadyCard payload={appReady} />
      ) : (
        <div
          className="max-w-[90%] text-[14px] leading-relaxed"
          style={{ color: "var(--text-primary)" }}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      )}
    </motion.div>
  );
}
