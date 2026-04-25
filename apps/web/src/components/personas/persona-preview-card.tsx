"use client";

import type { CSSProperties } from "react";
import type { Persona } from "@appio/themes";
import { personaInlineStyle, personaFallbackInlineStyle } from "@appio/themes";
import "./persona-preview.css";

interface PersonaPreviewCardProps {
  persona: Persona;
  scheme: "light" | "dark";
}

/**
 * Renders a persona preview using scoped CSS variables (no global pollution).
 * Hex fallback values are applied *after* OKLCH ones so OKLCH-unaware engines
 * (iOS 15 WebKit) paint the hex; modern browsers keep whichever is later but
 * both are the same color now that fallback drift is < 12 (validator-enforced).
 */
export function PersonaPreviewCard({ persona, scheme }: PersonaPreviewCardProps) {
  const oklchVars = personaInlineStyle(persona, scheme);
  const rgbVars = personaFallbackInlineStyle(persona, scheme);
  const style = { ...oklchVars, ...rgbVars } as CSSProperties;

  const destructiveStyle = {
    background: "var(--destructive)",
    color: "var(--destructive-foreground)",
  } as const;

  return (
    <div
      style={style}
      className="persona-preview"
      data-persona={persona.id}
      data-scheme={scheme}
    >
      <div className="persona-preview__inner">
        <header className="persona-preview__header">
          <div>
            <p className="persona-preview__eyebrow">{persona.inspiration.split("—")[0]?.trim()}</p>
            <h3 className="persona-preview__title">{persona.name}</h3>
          </div>
          <span className="persona-preview__badge">{scheme}</span>
        </header>

        <p className="persona-preview__copy">{persona.description}</p>

        <div className="persona-preview__swatches" aria-hidden="true">
          {(["primary", "secondary", "accent", "muted", "destructive"] as const).map((slot) => (
            <div
              key={slot}
              className="persona-preview__swatch"
              style={{ background: `var(--${slotToCssVar(slot)})` }}
              title={slot}
            />
          ))}
        </div>

        <div className="persona-preview__buttons">
          <button type="button" className="persona-preview__btn persona-preview__btn--primary">
            Get started
          </button>
          <button type="button" className="persona-preview__btn persona-preview__btn--secondary">
            Learn more
          </button>
          <button type="button" className="persona-preview__btn" style={destructiveStyle}>
            Delete
          </button>
        </div>

        <div className="persona-preview__card">
          <div className="persona-preview__card-row">
            <span className="persona-preview__card-label">Heading</span>
            <span className="persona-preview__card-heading">Aa</span>
          </div>
          <div className="persona-preview__card-row">
            <span className="persona-preview__card-label">Body</span>
            <span className="persona-preview__card-body">
              The quick brown fox jumps over the lazy dog
            </span>
          </div>
          <div className="persona-preview__card-row">
            <span className="persona-preview__card-label">Mono</span>
            <span className="persona-preview__card-mono">const persona = {persona.id};</span>
          </div>
        </div>

        <dl className="persona-preview__meta">
          <div>
            <dt>Radius</dt>
            <dd>{persona.shape.radius.md}rem</dd>
          </div>
          <div>
            <dt>Border</dt>
            <dd>{persona.shape.border.medium}px</dd>
          </div>
          <div>
            <dt>Motion</dt>
            <dd>{persona.motion.duration.medium}ms</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function slotToCssVar(slot: "primary" | "secondary" | "accent" | "muted" | "destructive"): string {
  return slot;
}
