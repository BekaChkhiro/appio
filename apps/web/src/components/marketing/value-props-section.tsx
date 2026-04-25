"use client";

import React from "react";

const VALUE_PROPS = [
  {
    n: "01",
    title: "Talk, don't prompt.",
    body: "Say what you want in plain language. Appio writes real React, asks follow-ups when it has to, and never lectures you on prompt engineering.",
  },
  {
    n: "02",
    title: "Installable from day one.",
    body: "Every build is a PWA. Your users add it to their home screen and it feels native — offline, push, the works.",
  },
  {
    n: "03",
    title: "Your data, your stack.",
    body: "Data lives in your Convex. Code exports as React. If Appio shuts down tomorrow, your app keeps running.",
  },
];

export function ValuePropsSection() {
  return (
    <section
      className="px-6 py-12 sm:px-12 lg:px-12 lg:py-24"
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        borderTop: "1px solid var(--hair)",
        borderBottom: "1px solid var(--hair)",
      }}
    >
      <div
        className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-12"
      >
        {VALUE_PROPS.map((v) => (
          <div key={v.n}>
            <div
              className="t-mono-sm"
              style={{ color: "var(--accent-token)", marginBottom: 16 }}
            >
              {v.n}
            </div>
            <div className="t-title" style={{ marginBottom: 12, color: "var(--text-primary)" }}>
              {v.title}
            </div>
            <div className="t-body muted">{v.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
