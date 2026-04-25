"use client";

import React from "react";

const HABITS = [
  { id: "meditate", name: "Meditate", time: "7 min", streak: 12, done: true, tint: "#6EE7B7" },
  { id: "read", name: "Read", time: "30 min", streak: 8, done: true, tint: "#FDE68A" },
  { id: "workout", name: "Workout", time: "45 min", streak: 24, done: false, tint: "#FCA5A5" },
  { id: "journal", name: "Journal", time: "10 min", streak: 5, done: false, tint: "#C4B5FD" },
];

function Icon({ name, size = 16, color = "currentColor" }: { name: string; size?: number; color?: string }) {
  const icons: Record<string, React.ReactNode> = {
    leaf: (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 16 C4 8 9 3 17 4 C17 12 12 17 4 16 Z" />
        <path d="M4 16 L12 8" />
      </svg>
    ),
    book: (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4 H9 a2 2 0 0 1 2 2 V17 a2 2 0 0 0 -2 -2 H4 Z" />
        <path d="M16 4 H11 a2 2 0 0 0 -2 2 V17 a2 2 0 0 1 2 -2 H16 Z" />
      </svg>
    ),
    dumbbell: (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="8" width="2" height="4" rx="0.5" />
        <rect x="4" y="6" width="3" height="8" rx="0.5" />
        <path d="M7 10 H13" />
        <rect x="13" y="6" width="3" height="8" rx="0.5" />
        <rect x="16" y="8" width="2" height="4" rx="0.5" />
      </svg>
    ),
    flame: (
      <svg width={size} height={size} viewBox="0 0 20 20" fill={color} stroke="none">
        <path d="M10 17 c3 0 5 -2 5 -5 c0 -3 -2 -4 -3 -7 c-1 2 -3 3 -3 5 c0 -1 -1 -2 -2 -2 c0 2 -2 3 -2 5 c0 3 2 4 5 4 Z" />
      </svg>
    ),
    check: (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10 L8 14 L16 5" />
      </svg>
    ),
  };
  return <>{icons[name] || null}</>;
}

export function StreakAppPreview({ scale = 1 }: { scale?: number }) {
  const px = (n: number) => n * scale;
  const completed = HABITS.filter((h) => h.done).length;
  const accent = "#7C5CFF";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0B0B0F",
        color: "#F5F3EE",
        fontFamily: "var(--font-sans)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div style={{ padding: `${px(8)}px ${px(20)}px ${px(16)}px`, height: "100%", overflow: "auto" }}>
          <div style={{ marginTop: px(6), marginBottom: px(20) }}>
            <div
              style={{
                fontSize: px(11),
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#8A8794",
                fontWeight: 600,
              }}
            >
              Wednesday, Apr 22
            </div>
            <div
              style={{
                fontSize: px(26),
                fontWeight: 600,
                letterSpacing: "-0.02em",
                marginTop: px(2),
              }}
            >
              Morning, Clara.
            </div>
          </div>

          {/* Big stat card */}
          <div
            style={{
              background: "#141418",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: px(12),
              padding: px(16),
              marginBottom: px(16),
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontSize: px(11),
                color: "#8A8794",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              Today
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: px(6), marginTop: px(4) }}>
              <span style={{ fontSize: px(36), fontWeight: 600, letterSpacing: "-0.03em" }}>{completed}</span>
              <span style={{ fontSize: px(18), color: "#8A8794" }}>/ {HABITS.length} habits</span>
            </div>
            <div
              style={{
                marginTop: px(12),
                height: px(6),
                borderRadius: px(3),
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${(completed / HABITS.length) * 100}%`,
                  height: "100%",
                  background: accent,
                  borderRadius: px(3),
                }}
              />
            </div>
          </div>

          {/* Habit list */}
          <div style={{ display: "flex", flexDirection: "column", gap: px(8) }}>
            {HABITS.map((h) => (
              <div
                key={h.id}
                style={{
                  background: "#141418",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: px(10),
                  padding: px(14),
                  display: "flex",
                  alignItems: "center",
                  gap: px(12),
                }}
              >
                <div
                  style={{
                    width: px(38),
                    height: px(38),
                    borderRadius: px(8),
                    background: `${h.tint}22`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: h.tint,
                    flexShrink: 0,
                  }}
                >
                  <Icon name={h.id === "journal" ? "flame" : h.id} size={px(18)} color={h.tint} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: px(15), fontWeight: 600, letterSpacing: "-0.01em" }}>{h.name}</div>
                  <div
                    style={{
                      fontSize: px(12),
                      color: "#8A8794",
                      marginTop: px(1),
                      display: "flex",
                      gap: px(8),
                      alignItems: "center",
                    }}
                  >
                    <span>{h.time}</span>
                    <span
                      style={{ width: px(2), height: px(2), borderRadius: "50%", background: "#8A8794" }}
                    />
                    <Icon name="flame" size={px(11)} color="#8A8794" />
                    <span>{h.streak} day streak</span>
                  </div>
                </div>
                <div
                  style={{
                    width: px(26),
                    height: px(26),
                    borderRadius: "50%",
                    border: h.done ? "none" : "1.5px solid #8A8794",
                    background: h.done ? accent : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                  }}
                >
                  {h.done && <Icon name="check" size={px(14)} color="#fff" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          padding: `${px(8)}px ${px(20)}px ${px(8)}px`,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          background: "#0B0B0F",
        }}
      >
        {["home", "chart", "plus", "flame", "user"].map((icon, i) => (
          <div key={icon} style={{ padding: px(6) }}>
            {icon === "plus" ? (
              <div
                style={{
                  width: px(36),
                  height: px(36),
                  borderRadius: "50%",
                  background: accent,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PlusIcon size={px(18)} />
              </div>
            ) : (
              <NavIcon name={icon} size={px(22)} active={i === 0} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlusIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 4 V16" />
      <path d="M4 10 H16" />
    </svg>
  );
}

function NavIcon({ name, size = 22, active }: { name: string; size?: number; active?: boolean }) {
  const color = active ? "#7C5CFF" : "#8A8794";
  const sw = active ? 2 : 1.5;
  const icons: Record<string, React.ReactNode> = {
    home: (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9 L10 3 L17 9 V16 a1 1 0 0 1 -1 1 H4 a1 1 0 0 1 -1 -1 Z" />
        <path d="M8 17 V11 H12 V17" />
      </svg>
    ),
    chart: (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17 H17" />
        <path d="M5 14 V10" />
        <path d="M9 14 V6" />
        <path d="M13 14 V11" />
        <path d="M17 14 V4" />
      </svg>
    ),
    flame: (
      <svg width={size} height={size} viewBox="0 0 20 20" fill={color} stroke="none">
        <path d="M10 17 c3 0 5 -2 5 -5 c0 -3 -2 -4 -3 -7 c-1 2 -3 3 -3 5 c0 -1 -1 -2 -2 -2 c0 2 -2 3 -2 5 c0 3 2 4 5 4 Z" />
      </svg>
    ),
    user: (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="7" r="3" />
        <path d="M3 17 C4 13 7 12 10 12 C13 12 16 13 17 17" />
      </svg>
    ),
  };
  return <>{icons[name] || null}</>;
}
