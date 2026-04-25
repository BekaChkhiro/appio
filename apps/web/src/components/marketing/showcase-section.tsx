"use client";

import React from "react";
import Link from "next/link";
import { IPhoneFrame } from "./iphone-frame";
import { MiniApp } from "./mini-app-previews";
import { ArrowRight } from "lucide-react";

const SHOWCASE = [
  {
    app: "Morning Pages",
    creator: "Clara",
    role: "Writer",
    quote: '"It felt less like coding and more like dictating a letter."',
    time: "Built in 2 hours",
    kind: "journal",
  },
  {
    app: "devonlin.app",
    creator: "Dev",
    role: "Link-in-bio",
    quote: '"I replaced three tools I was paying for."',
    time: "Built in 45 minutes",
    kind: "bio",
  },
  {
    app: "Iron Week",
    creator: "Marco",
    role: "Powerlifter",
    quote: '"My coach uses it. My lifts use it. Great app, stupid name."',
    time: "Built in 4 hours",
    kind: "workout",
  },
  {
    app: "Pan & Co",
    creator: "Sofia",
    role: "Bakery owner",
    quote: '"Daily menu updates used to take an hour. Now it\'s a sentence."',
    time: "Built in 1 hour",
    kind: "bakery",
  },
];

function ShowcaseCard({
  app,
  creator,
  role,
  quote,
  time,
  kind,
  accent,
}: {
  app: string;
  creator: string;
  role: string;
  quote: string;
  time: string;
  kind: string;
  accent: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--hair)",
        borderRadius: 14,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {accent && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "var(--accent-token)",
          }}
        />
      )}
      <div
        style={{
          aspectRatio: "4/5",
          background: "var(--surface-2)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          borderBottom: "1px solid var(--hair)",
          padding: "24px 0 0",
        }}
      >
        <div style={{ transform: "translateY(12%)" }}>
          <IPhoneFrame width={150}>
            <MiniApp kind={kind} scale={150 / 393} />
          </IPhoneFrame>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--accent-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent-token)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {creator[0]}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{creator}</div>
            <div className="t-caption">
              {role} · {app}
            </div>
          </div>
        </div>
        <div className="t-body muted" style={{ fontStyle: "italic", minHeight: 60 }}>
          {quote}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid var(--hair)",
          }}
        >
          <span
            className="t-mono-sm"
            style={{ color: accent ? "var(--accent-token)" : "var(--text-muted)" }}
          >
            {time}
          </span>
          <ArrowRight className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
        </div>
      </div>
    </div>
  );
}

export function ShowcaseSection() {
  return (
    <section
      id="showcase"
      className="px-6 py-16 sm:px-12 lg:px-12 lg:py-24"
      style={{
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 48,
        }}
      >
        <div>
          <div className="t-overline" style={{ color: "var(--accent-token)", marginBottom: 8 }}>
            Showcase
          </div>
          <div className="t-display" style={{ color: "var(--text-primary)" }}>
            Apps shipped in an afternoon.
          </div>
        </div>
        <Link
          href="#"
          className="t-caption hidden items-center gap-1 sm:inline-flex"
          style={{ cursor: "pointer", textDecoration: "none" }}
        >
          See all 230 <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div
        className="showcase-grid grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        {SHOWCASE.map((s, i) => (
          <ShowcaseCard key={s.app} {...s} accent={i === 1} />
        ))}
      </div>
    </section>
  );
}
