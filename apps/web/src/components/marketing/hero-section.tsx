"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@appio/ui";
import { IPhoneFrame } from "./iphone-frame";
import { StreakAppPreview } from "./streak-app-preview";
import { ArrowRight } from "lucide-react";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        padding: "5px 10px",
        border: "1px solid var(--hair)",
        borderRadius: 999,
        color: "var(--text-muted)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--accent-token)",
        }}
      />
      {children}
    </span>
  );
}

function UserMessage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
      <div
        style={{
          maxWidth: "85%",
          background: "var(--surface-2)",
          border: "1px solid var(--hair)",
          color: "var(--text-primary)",
          padding: "10px 14px",
          borderRadius: 14,
          borderBottomRightRadius: 4,
          fontSize: 14,
          lineHeight: 1.55,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function AssistantMessage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.6, color: "var(--text-primary)" }}>
      {children}
    </div>
  );
}

function DiffCard({ title, files }: { title: string; files: string }) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--hair)",
        borderRadius: 10,
        marginBottom: 12,
        overflow: "hidden",
        animation: "diffIn 220ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: "var(--accent-soft)",
            color: "var(--accent-token)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3 L17 6 L6 17 L3 14 Z" />
            <path d="M11 6 L14 9" />
            <path d="M16 12 L16.5 13.5 L18 14 L16.5 14.5 L16 16 L15.5 14.5 L14 14 L15.5 13.5 Z" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em" }}>{title}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{files}</div>
        </div>
      </div>
    </div>
  );
}

function LandingDemoCard() {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--hair)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "var(--shadow-card)",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Chip>Assistant is writing</Chip>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "var(--text-subtle)",
            fontFamily: "var(--font-mono)",
          }}
        >
          00:14
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px]">
        <div>
          <UserMessage>make the habit cards more playful</UserMessage>
          <AssistantMessage>
            Softened the corners, bumped the icons, added a little rotation per card. Streak count still primary.
          </AssistantMessage>
          <DiffCard title="Updated: Home screen" files="3 files · HabitCard, theme.ts" />
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <IPhoneFrame width={180}>
            <StreakAppPreview scale={180 / 393} />
          </IPhoneFrame>
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section
      className="px-6 py-16 sm:px-12 lg:px-12 lg:py-24"
      style={{
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      <div
        className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16"
      >
        <div>
          <span style={{ display: "inline-flex", marginBottom: 32 }}>
            <Chip>Sprint 2 · open beta</Chip>
          </span>
          <h1
            className="t-display-xl"
            style={{
              margin: 0,
              maxWidth: 640,
              color: "var(--text-primary)",
            }}
          >
            Build your app
            <br />
            by talking
            <br />
            <span style={{ color: "var(--accent-token)" }}>to it.</span>
          </h1>
          <p
            className="t-body-lg muted"
            style={{ maxWidth: 460, marginTop: 24 }}
          >
            Appio turns a sentence into a real React PWA — installable, your data, no developer handholding. For the
            hobbyists, makers, and small-business owners who have the idea and are tired of waiting.
          </p>
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 32,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Button size="lg" asChild>
              <Link href="/build" className="inline-flex items-center gap-2">
                Start building free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="lg" asChild>
              <Link href="#">Watch a 40s demo</Link>
            </Button>
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 12,
              color: "var(--text-subtle)",
              fontFamily: "var(--font-mono)",
            }}
          >
            No credit card · Own your code · Export anytime
          </div>
        </div>

        {/* Live demo card */}
        <LandingDemoCard />
      </div>
    </section>
  );
}
