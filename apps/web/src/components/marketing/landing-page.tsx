"use client";

import React from "react";
import { HeroSection } from "./hero-section";
import { ValuePropsSection } from "./value-props-section";
import { ShowcaseSection } from "./showcase-section";
import { FAQSection } from "./faq-section";
import { LandingFooter } from "./landing-footer";

export function LandingPage() {
  return (
    <div
      className="scroll"
      style={{
        minHeight: "100%",
        overflow: "auto",
        background: "var(--surface-0)",
      }}
    >
      <HeroSection />
      <ValuePropsSection />
      <ShowcaseSection />
      <FAQSection />
      <LandingFooter />
    </div>
  );
}
