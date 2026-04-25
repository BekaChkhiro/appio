"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, AlertTriangle } from "lucide-react";
import { Button } from "@appio/ui";
import { personaList, validateAllPersonas, type Persona } from "@appio/themes";
import { PersonaPreviewCard } from "./persona-preview-card";

const SCHEME_OPTIONS = ["light", "dark", "both"] as const;
type SchemeOption = (typeof SCHEME_OPTIONS)[number];

export function PersonaGallery() {
  const [scheme, setScheme] = useState<SchemeOption>("both");
  const validation = validateAllPersonas(personaList);

  const errorCount = validation.issues.filter((i) => i.severity === "error").length;
  const warningCount = validation.issues.filter((i) => i.severity === "warning").length;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link href="/build">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Theme Personas</h1>
          <p className="text-xs text-muted-foreground">
            5 curated design systems for generated PWAs. Each persona ships its own OKLCH palette,
            typography, radius/shadow, and motion timings.
          </p>
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
            errorCount === 0
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-destructive/10 text-destructive"
          }`}
          title={`${errorCount} errors, ${warningCount} warnings`}
        >
          {errorCount === 0 ? (
            <>
              <Check className="h-3.5 w-3.5" />
              WCAG AA
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5" />
              {errorCount} errors
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border px-6 py-3">
        <span className="text-xs font-medium text-muted-foreground">Scheme</span>
        <div className="flex gap-1 rounded-md bg-muted p-0.5">
          {SCHEME_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setScheme(opt)}
              className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                scheme === opt
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-8 p-6">
        {personaList.map((persona) => (
          <PersonaRow key={persona.id} persona={persona} scheme={scheme} />
        ))}
      </div>
    </div>
  );
}

function PersonaRow({ persona, scheme }: { persona: Persona; scheme: SchemeOption }) {
  return (
    <section aria-labelledby={`persona-${persona.id}`} className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 id={`persona-${persona.id}`} className="font-mono text-sm text-muted-foreground">
          {persona.id}
        </h2>
        <span className="text-xs text-muted-foreground">{persona.inspiration}</span>
      </div>
      <div
        className={`grid gap-4 ${
          scheme === "both" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {(scheme === "both" || scheme === "light") && (
          <PersonaPreviewCard persona={persona} scheme="light" />
        )}
        {(scheme === "both" || scheme === "dark") && (
          <PersonaPreviewCard persona={persona} scheme="dark" />
        )}
      </div>
    </section>
  );
}
