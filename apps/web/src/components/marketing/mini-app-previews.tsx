"use client";

import React from "react";

export function MiniApp({ kind, scale = 1 }: { kind: string; scale?: number }) {
  const inner = { width: 393, height: 852, transform: `scale(${scale})`, transformOrigin: "top left" };
  const wrap = { width: 393 * scale, height: 852 * scale, overflow: "hidden", position: "relative" as const };
  return (
    <div style={wrap}>
      <div style={inner}>{renderMini(kind)}</div>
    </div>
  );
}

function renderMini(kind: string) {
  if (kind === "journal") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#F5EFE4",
          color: "#2A2418",
          padding: "70px 36px 0",
          fontFamily: "var(--font-display), Georgia, serif",
          position: "relative",
        }}
      >
        <div style={{ fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8A7355", marginBottom: 24 }}>
          Morning Pages
        </div>
        <div style={{ fontSize: 44, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: 4 }}>Wednesday,</div>
        <div style={{ fontSize: 44, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.05, fontStyle: "italic", marginBottom: 40 }}>
          April 23
        </div>
        <div style={{ fontSize: 18, lineHeight: 1.7, color: "#4A3E28" }}>
          Woke before the light. The kitchen is colder than it should be for April. Three pages today — no fewer.
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 120,
            left: 36,
            right: 36,
            fontSize: 12,
            color: "#8A7355",
            fontFamily: "var(--font-mono), monospace",
            letterSpacing: "0.1em",
          }}
        >
          01 / 03 PAGES
        </div>
      </div>
    );
  }
  if (kind === "bio") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0E1712",
          color: "#E8F5EC",
          padding: "70px 30px 0",
          fontFamily: "var(--font-sans), sans-serif",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #6EE7B7, #10B981)",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0E1712",
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            D
          </div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>@devonlin</div>
          <div style={{ fontSize: 14, color: "#6EE7B7", marginTop: 4 }}>designer · photos · occasional thoughts</div>
        </div>
        {["Portfolio", "Newsletter", "Photography", "Podcast", "Store"].map((l) => (
          <div
            key={l}
            style={{
              background: "rgba(110,231,183,0.08)",
              border: "1px solid rgba(110,231,183,0.2)",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 10,
              fontSize: 15,
              fontWeight: 500,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{l}</span>
            <span style={{ color: "#6EE7B7" }}>↗</span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "workout") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0A0A0A",
          color: "#fff",
          padding: "70px 28px 0",
          fontFamily: "var(--font-sans), sans-serif",
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: "0.25em", color: "#FB923C", marginBottom: 8, fontWeight: 700 }}>IRON WEEK</div>
        <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 4 }}>WEEK 14</div>
        <div style={{ fontSize: 16, color: "#8A8A8A", marginBottom: 36 }}>4 of 5 sessions · 1 to go</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 32 }}>
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => {
            const done = [0, 1, 2, 4].includes(i);
            const today = i === 3;
            return (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#6A6A6A", marginBottom: 6 }}>{d}</div>
                <div
                  style={{
                    aspectRatio: "1/1",
                    background: done ? "#FB923C" : today ? "transparent" : "#1A1A1A",
                    border: today ? "2px solid #FB923C" : "none",
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0A0A0A",
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  {done ? "✓" : ""}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ borderTop: "1px solid #1A1A1A", paddingTop: 20 }}>
          <div style={{ fontSize: 12, color: "#6A6A6A", marginBottom: 4 }}>SQUAT PR</div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em" }}>
            185<span style={{ fontSize: 16, color: "#FB923C", marginLeft: 6 }}>kg</span>
          </div>
        </div>
      </div>
    );
  }
  if (kind === "bakery") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#F2EADB",
          color: "#3E2B1C",
          fontFamily: "var(--font-display), Georgia, serif",
          position: "relative",
        }}
      >
        <div
          style={{
            height: 260,
            background: "linear-gradient(180deg, #C98B5A, #9A5A2E)",
            position: "relative",
            display: "flex",
            alignItems: "flex-end",
            padding: 24,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.3,
              background: "repeating-radial-gradient(circle at 30% 40%, #8A4A20 0 3px, transparent 3px 12px)",
            }}
          />
          <div
            style={{
              color: "#F2EADB",
              fontSize: 12,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              fontFamily: "var(--font-sans), sans-serif",
              fontWeight: 600,
              zIndex: 1,
            }}
          >
            Today&apos;s menu
          </div>
        </div>
        <div style={{ padding: "24px 28px" }}>
          <div style={{ fontSize: 32, fontWeight: 600, fontStyle: "italic", letterSpacing: "-0.01em", marginBottom: 2 }}>
            Pan &amp; Co
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#8A6A45",
              fontFamily: "var(--font-sans), sans-serif",
              marginBottom: 20,
              letterSpacing: "0.05em",
            }}
          >
            APR 23 · WED · OPEN UNTIL 18:00
          </div>
          {[
            { n: "Country Sourdough", d: "24h ferment · rye starter", p: "€8" },
            { n: "Butter Croissant", d: "French butter · 3-day laminate", p: "€3.20" },
            { n: "Cardamom Bun", d: "Swedish-style · hand-knotted", p: "€4" },
          ].map((i) => (
            <div
              key={i.n}
              style={{
                padding: "14px 0",
                borderBottom: "1px solid #D8CAB0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 500 }}>{i.n}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#8A6A45",
                    fontFamily: "var(--font-sans), sans-serif",
                    marginTop: 2,
                  }}
                >
                  {i.d}
                </div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{i.p}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}
