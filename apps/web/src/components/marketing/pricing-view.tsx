"use client";

import React from "react";
import { Button } from "@appio/ui";
import { Check } from "lucide-react";

const PLANS = [
  {
    tier: "Free",
    price: "$0",
    freq: "forever",
    features: ["3 apps", "50 generations/mo", "Appio subdomain", "Community support"],
    cta: "Start free",
    active: false,
    primary: false,
  },
  {
    tier: "Creator",
    price: "$19",
    freq: "per month",
    features: ["Unlimited apps", "500 generations/mo", "Custom domain", "Email support", "Priority queue"],
    cta: "Start free trial",
    active: false,
    primary: true,
  },
  {
    tier: "Pro",
    price: "$49",
    freq: "per month",
    features: ["Everything in Creator", "2,000 generations/mo", "Team seats", "SSO & audit log", "Dedicated support"],
    cta: "Contact sales",
    active: false,
    primary: false,
  },
];

function PlanCard({
  tier,
  price,
  freq,
  features,
  cta,
  active,
  primary,
}: {
  tier: string;
  price: string;
  freq: string;
  features: string[];
  cta: string;
  active: boolean;
  primary: boolean;
}) {
  return (
    <div
      style={{
        background: active ? "var(--accent-soft)" : "var(--surface-1)",
        border: `1px solid ${active ? "var(--accent-token)" : "var(--hair)"}`,
        borderRadius: 12,
        padding: 24,
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {active && (
        <span
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            fontSize: 11,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: 999,
            background: "var(--success-soft)",
            color: "var(--success)",
          }}
        >
          Current
        </span>
      )}
      <div
        className="t-overline"
        style={{
          color: active ? "var(--accent-token)" : "var(--text-muted)",
          marginBottom: 8,
        }}
      >
        {tier}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 20 }}>
        <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
          {price}
        </span>
        <span className="t-caption">{freq}</span>
      </div>
      <div style={{ flex: 1 }}>
        {features.map((f) => (
          <div
            key={f}
            style={{
              padding: "6px 0",
              display: "flex",
              gap: 8,
              fontSize: 13,
              color: "var(--text-muted)",
              alignItems: "center",
            }}
          >
            <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent-token)" }} />
            <span>{f}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24 }}>
        <Button
          variant={primary ? "default" : active ? "secondary" : "ghost"}
          className="w-full"
          disabled={active}
        >
          {cta}
        </Button>
      </div>
    </div>
  );
}

export function PricingView() {
  return (
    <div
      style={{
        minHeight: "100%",
        background: "var(--surface-0)",
        padding: "48px 48px 96px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div className="t-overline" style={{ color: "var(--accent-token)", marginBottom: 8 }}>
            Pricing
          </div>
          <div className="t-display" style={{ color: "var(--text-primary)" }}>
            Simple, transparent pricing.
          </div>
          <div className="t-body-lg muted" style={{ marginTop: 12, maxWidth: 520, margin: "12px auto 0" }}>
            Start free. Upgrade when you need more.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
          className="pricing-grid"
        >
          {PLANS.map((plan) => (
            <PlanCard key={plan.tier} {...plan} />
          ))}
        </div>
      </div>
    </div>
  );
}
