import { notFound } from "next/navigation";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Markdown files live in `/legal/*.md` at the monorepo root — the source of
// truth. We read them at build time, strip draft placeholders, and render.

const LEGAL_DIR = path.resolve(process.cwd(), "../../legal");

const SLUG_TO_FILE: Record<string, { title: string; description: string; file: string }> = {
  terms: {
    title: "Terms of Service",
    description: "The rules that govern your use of Appio.",
    file: "terms-of-service.md",
  },
  privacy: {
    title: "Privacy Policy",
    description: "How Appio collects, uses, and protects your data.",
    file: "privacy-policy.md",
  },
  cookies: {
    title: "Cookie Policy",
    description: "What cookies and storage Appio uses, and why.",
    file: "cookie-policy.md",
  },
  dmca: {
    title: "DMCA Policy",
    description: "How to report copyright infringement on Appio.",
    file: "dmca-policy.md",
  },
  "acceptable-use": {
    title: "Acceptable Use Policy",
    description: "What you can and can't build or publish on Appio.",
    file: "acceptable-use-policy.md",
  },
  "marketplace-seller": {
    title: "Marketplace Seller Terms",
    description: "Terms for creators publishing to the Appio marketplace.",
    file: "marketplace-seller-terms.md",
  },
};

// Defaults that make the docs readable while still clearly labeled as drafts.
// Real values must be filled in by Appio's legal counsel before launch.
const PLACEHOLDER_DEFAULTS: Record<string, string> = {
  COMPANY_NAME: "Appio, Inc.",
  REGISTERED_ADDRESS: "[Registered address]",
  JURISDICTION: "[Jurisdiction]",
  EFFECTIVE_DATE: "TBD",
  LAST_UPDATED: "TBD",
  LEGAL_EMAIL: "legal@appio.app",
  SUPPORT_EMAIL: "support@appio.app",
  ABUSE_EMAIL: "abuse@appio.app",
  DMCA_AGENT_EMAIL: "dmca@appio.app",
  CONTACT_EMAIL: "hello@appio.app",
};

function fillPlaceholders(body: string): string {
  return body.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    return PLACEHOLDER_DEFAULTS[key] ?? `[${key}]`;
  });
}

async function loadDoc(slug: string): Promise<string | null> {
  const entry = SLUG_TO_FILE[slug];
  if (!entry) return null;
  try {
    const raw = await readFile(path.join(LEGAL_DIR, entry.file), "utf-8");
    return fillPlaceholders(raw);
  } catch {
    return null;
  }
}

export async function generateStaticParams() {
  // Only surface documents whose file actually exists on disk at build time.
  let present: Set<string>;
  try {
    present = new Set(await readdir(LEGAL_DIR));
  } catch {
    return [];
  }
  return Object.entries(SLUG_TO_FILE)
    .filter(([, v]) => present.has(v.file))
    .map(([slug]) => ({ slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const entry = SLUG_TO_FILE[slug];
  if (!entry) return { title: "Legal" };
  return {
    title: entry.title,
    description: entry.description,
  };
}

export default async function LegalPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const entry = SLUG_TO_FILE[slug];
  const body = await loadDoc(slug);
  if (!entry || body === null) notFound();

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10 md:py-16">
      <Link
        href="/legal"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> All legal documents
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {entry.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{entry.description}</p>
      </header>

      <div className="mb-8 flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p>
          <strong>Draft — pending legal review.</strong> This document is a
          template. Placeholders in square brackets must be replaced and the
          final version reviewed by qualified counsel before launch.
        </p>
      </div>

      <div className="prose prose-invert max-w-none text-foreground prose-headings:text-foreground prose-a:text-primary prose-strong:text-foreground prose-code:text-foreground prose-li:marker:text-muted-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    </article>
  );
}
