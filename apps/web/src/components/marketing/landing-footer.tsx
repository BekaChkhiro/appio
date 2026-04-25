"use client";

import React from "react";

function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        background: "var(--accent-token, #7C5CFF)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: size * 0.6,
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        letterSpacing: "-0.03em",
        flexShrink: 0,
      }}
    >
      A
    </div>
  );
}

const FOOTER_LINKS = [
  ["Product", ["Showcase", "Pricing", "Changelog", "Roadmap"]],
  ["Creator", ["Docs", "Templates", "Community", "Support"]],
  ["Company", ["About", "Blog", "Privacy", "Terms"]],
];

export function LandingFooter() {
  return (
    <footer
      className="px-6 py-12 sm:px-12"
      style={{
        borderTop: "1px solid var(--hair)",
        color: "var(--text-muted)",
      }}
    >
      <div
        className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:grid-cols-[2fr_1fr_1fr_1fr]"
        style={{
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <LogoMark size={20} />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 16,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Appio
            </span>
          </div>
          <div className="t-caption" style={{ maxWidth: 320 }}>
            Build your app by talking to it.
          </div>
        </div>
        {FOOTER_LINKS.map(([h, links]) => (
          <div key={h as string}>
            <div
              className="t-overline"
              style={{ marginBottom: 12, color: "var(--text-primary)" }}
            >
              {h as string}
            </div>
            {(links as string[]).map((l) => (
              <div
                key={l}
                className="t-caption"
                style={{
                  marginBottom: 6,
                  cursor: "pointer",
                }}
              >
                {l}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div
        style={{
          maxWidth: 1280,
          margin: "48px auto 0",
          paddingTop: 24,
          borderTop: "1px solid var(--hair)",
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          color: "var(--text-subtle)",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span>© 2026 Appio. Built by a solo dev in public.</span>
        <span>v0.4.1-beta</span>
      </div>
    </footer>
  );
}
