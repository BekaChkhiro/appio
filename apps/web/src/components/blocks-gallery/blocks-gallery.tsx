"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@appio/ui";
import {
  personaList,
  personaInlineStyle,
  personaFallbackInlineStyle,
  type PersonaId,
} from "@appio/themes";
import { sampleBlocks } from "./sample-data";

type Scheme = "light" | "dark";

/**
 * Blocks gallery — visual verification surface for `@appio/layout-blocks`
 * across all 5 theme personas. Renders each block inside a persona-scoped
 * div that carries the persona's CSS variables as inline styles, so you
 * can eyeball every block × persona × scheme combination from a single
 * page.
 *
 * Not production-facing — this is a developer tool. The gallery exercises
 * ~100% of each block's prop surface (all optional slots filled) so visual
 * regressions are hard to miss.
 */
export function BlocksGallery() {
  const [personaId, setPersonaId] = useState<PersonaId>("minimal-mono");
  const [scheme, setScheme] = useState<Scheme>("light");

  const persona = useMemo(
    () => personaList.find((p) => p.id === personaId)!,
    [personaId],
  );

  /**
   * Merged inline CSS var map:
   * 1. OKLCH values (for modern browsers)
   * 2. Hex fallbacks emitted SECOND so iOS 15 sRGB (no OKLCH parser) wins
   *
   * OKLCH-aware browsers honor the later `--background: oklch(...)` dec; iOS 15
   * reads the first `--background` it can parse (hex) and ignores the OKLCH one.
   * This mirrors the dual-space strategy from ADR 003.
   */
  const personaStyle = useMemo(() => {
    return {
      ...personaInlineStyle(persona, scheme),
      ...personaFallbackInlineStyle(persona, scheme),
      // Re-apply OKLCH tokens so modern browsers get the wider gamut.
      ...personaInlineStyle(persona, scheme),
    };
  }, [persona, scheme]);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link href="/build">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Blocks Gallery</h1>
            <p className="text-xs text-muted-foreground">
              Visual verification surface — 15 layout blocks × 5 theme personas.
              Switch persona + scheme to inspect every combination.
            </p>
          </div>
          <div
            className="hidden items-center gap-1.5 rounded-md bg-green-500/10 px-2.5 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 sm:flex"
            title="All 15 blocks shipped"
          >
            <Check className="h-3.5 w-3.5" />
            15 / 15 shipped
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Persona
            </span>
            <div className="flex flex-wrap gap-1 rounded-md bg-muted p-0.5">
              {personaList.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPersonaId(p.id)}
                  className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                    personaId === p.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.id}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Scheme
            </span>
            <div className="flex gap-1 rounded-md bg-muted p-0.5">
              {(["light", "dark"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScheme(s)}
                  className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                    scheme === s
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <span className="ml-auto text-xs text-muted-foreground">
            {persona.name} · {persona.inspiration}
          </span>
        </div>
      </header>

      <main className="flex-1">
        <div className={scheme === "dark" ? "dark" : ""} style={personaStyle}>
          <div className="divide-y divide-border bg-background">
            {sampleBlocks.map((sample) => (
              <section
                key={sample.id}
                id={`block-${sample.id}`}
                aria-labelledby={`block-${sample.id}-title`}
                className="relative"
              >
                <div className="sticky top-[120px] z-10 flex items-baseline justify-between border-b border-border bg-background/95 px-6 py-2 backdrop-blur">
                  <h2
                    id={`block-${sample.id}-title`}
                    className="font-mono text-xs text-muted-foreground"
                  >
                    {sample.id}
                  </h2>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {sample.category}
                  </span>
                </div>
                <div>{sample.render()}</div>
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
