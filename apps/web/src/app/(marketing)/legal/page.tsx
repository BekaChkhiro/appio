import Link from "next/link";
import type { Metadata } from "next";
import { FileText } from "lucide-react";

const DOCS = [
  { slug: "terms", title: "Terms of Service", description: "The rules that govern your use of Appio." },
  { slug: "privacy", title: "Privacy Policy", description: "How Appio collects, uses, and protects your data." },
  { slug: "cookies", title: "Cookie Policy", description: "What cookies and storage Appio uses, and why." },
  { slug: "acceptable-use", title: "Acceptable Use Policy", description: "What you can and can't build on Appio." },
  { slug: "dmca", title: "DMCA Policy", description: "How to report copyright infringement." },
  { slug: "marketplace-seller", title: "Marketplace Seller Terms", description: "Terms for marketplace creators." },
];

export const metadata: Metadata = {
  title: "Legal",
  description: "Legal documents for Appio: Terms, Privacy, DMCA, and more.",
};

export default function LegalIndexPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Legal</h1>
        <p className="mt-2 text-muted-foreground">
          All Appio legal and policy documents.
        </p>
      </header>

      <ul className="grid gap-3">
        {DOCS.map((doc) => (
          <li key={doc.slug}>
            <Link
              href={`/legal/${doc.slug}`}
              className="flex items-start gap-4 rounded-lg border border-border p-4 transition-colors hover:border-primary/60 hover:bg-accent"
            >
              <FileText className="mt-1 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{doc.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {doc.description}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
