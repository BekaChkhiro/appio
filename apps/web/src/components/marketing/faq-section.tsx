"use client";

import React, { useState } from "react";
import { Plus, Minus } from "lucide-react";

const FAQS = [
  {
    q: "Do I need to know how to code?",
    a: "No. If you can describe what the app should do, Appio can build it. Technical view is there if you want it, hidden if you don't.",
  },
  {
    q: "Who owns the code?",
    a: "You do. Export as a GitHub repo anytime. We don't hold your work hostage.",
  },
  {
    q: "Why do I connect my own Convex account?",
    a: "Because your users' data should live in your database, not ours. It's two clicks and it means you keep control, forever.",
  },
  {
    q: "What happens when I want a real developer to take over?",
    a: "They open the exported repo in Cursor or VS Code. It's just React + Convex — no lock-in, no weird DSL.",
  },
  {
    q: "Is it really fast enough for non-developers?",
    a: "Creators in our beta shipped their first app in under 3 hours on average. Several did it in one.",
  },
];

function FAQItem({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      onClick={() => setOpen(!open)}
      style={{
        padding: "20px 0",
        borderBottom: "1px solid var(--hair)",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="t-h3" style={{ color: "var(--text-primary)", paddingRight: 16 }}>
          {q}
        </div>
        {open ? (
          <Minus className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--text-muted)" }} />
        ) : (
          <Plus className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--text-muted)" }} />
        )}
      </div>
      {open && (
        <div className="t-body-lg muted" style={{ marginTop: 12, maxWidth: 720 }}>
          {a}
        </div>
      )}
    </div>
  );
}

export function FAQSection() {
  return (
    <section
      className="px-6 py-12 sm:px-12 lg:px-12 lg:py-24"
      style={{
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <div className="t-overline" style={{ color: "var(--accent-token)", marginBottom: 8 }}>
        Questions
      </div>
      <div className="t-display" style={{ marginBottom: 48, color: "var(--text-primary)" }}>
        Fair things to ask.
      </div>
      {FAQS.map((f, i) => (
        <FAQItem key={i} q={f.q} a={f.a} defaultOpen={i === 0} />
      ))}
    </section>
  );
}
