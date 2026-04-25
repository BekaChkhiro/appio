import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import type { BlockMetadata } from "../types";

export interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface FooterLinkColumn {
  heading: string;
  links: readonly FooterLink[];
}

export interface FooterSocialLink {
  /** Accessible label — "Twitter", "GitHub", etc. */
  label: string;
  href: string;
  /** Icon node. Typically a `lucide-react` icon sized to default (16px). */
  icon: ReactNode;
}

export interface FooterMultiProps {
  /** Brand slot — a logo, wordmark, or JSX — rendered above the tagline. */
  brand?: ReactNode;
  /** Tagline under the brand. One short sentence. */
  tagline?: string;
  /** 1-4 link columns — more than 4 columns cramps on desktop. */
  linkColumns?: readonly FooterLinkColumn[];
  /** Social icon links — rendered as a row under the brand column. */
  socialLinks?: readonly FooterSocialLink[];
  /**
   * Bottom bar copyright text. Typically "© 2026 Acme. All rights reserved."
   * Renderers may also pass their own JSX for localized strings.
   */
  copyright?: ReactNode;
  /**
   * Bottom bar secondary links — Privacy, Terms, Status. Max ~3.
   */
  bottomLinks?: readonly FooterLink[];
  /** Extra classes merged into the outer footer. */
  className?: string;
}

/**
 * Multi-column site footer. Brand + tagline + social row on the left, 1-4
 * link columns on the right. Collapses to a single column on mobile.
 *
 * Non-animated by design — site footers should feel stable and grounded,
 * not slide in. Placing a motion wrapper here would also fight with any
 * hero animation above it (both would compete for the viewport focal point).
 */
export function FooterMulti(props: FooterMultiProps) {
  const {
    brand,
    tagline,
    linkColumns,
    socialLinks,
    copyright,
    bottomLinks,
    className,
  } = props;

  const hasLinkColumns = linkColumns !== undefined && linkColumns.length > 0;
  const hasBottomBar =
    copyright !== undefined ||
    (bottomLinks !== undefined && bottomLinks.length > 0);

  return (
    <footer
      className={cn(
        "w-full border-t border-border bg-background text-foreground",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
        <div
          className={cn(
            "grid grid-cols-1 gap-10",
            hasLinkColumns && "md:grid-cols-[1.5fr_3fr]",
          )}
        >
          <div className="flex flex-col gap-4">
            {brand !== undefined && (
              <div className="text-foreground">{brand}</div>
            )}
            {tagline !== undefined && (
              <p className="max-w-sm text-sm text-muted-foreground">
                {tagline}
              </p>
            )}
            {socialLinks !== undefined && socialLinks.length > 0 && (
              <ul className="flex list-none flex-wrap gap-3 p-0 pt-2">
                {socialLinks.map((social) => (
                  <li key={social.href}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={social.label}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      {social.icon}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {hasLinkColumns && (
            <nav
              aria-label="Footer"
              className={cn(
                "grid grid-cols-2 gap-8",
                linkColumns.length >= 3 && "sm:grid-cols-3",
                linkColumns.length >= 4 && "md:grid-cols-4",
              )}
            >
              {linkColumns.map((column, index) => (
                <div
                  key={`${column.heading}-${index}`}
                  className="flex flex-col gap-3"
                >
                  <h3
                    className="text-sm font-semibold text-foreground"
                    style={{ fontFamily: "var(--font-heading, inherit)" }}
                  >
                    {column.heading}
                  </h3>
                  <ul className="flex list-none flex-col gap-2 p-0">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          target={link.external === true ? "_blank" : undefined}
                          rel={link.external === true ? "noreferrer" : undefined}
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          )}
        </div>

        {hasBottomBar && (
          <div className="mt-12 flex flex-col items-start gap-4 border-t border-border pt-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            {copyright !== undefined && <div>{copyright}</div>}
            {bottomLinks !== undefined && bottomLinks.length > 0 && (
              <ul className="flex list-none flex-wrap gap-6 p-0">
                {bottomLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target={link.external === true ? "_blank" : undefined}
                      rel={link.external === true ? "noreferrer" : undefined}
                      className="transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}

export const footerMultiMetadata: BlockMetadata = {
  id: "footer-multi",
  name: "Footer Multi-column",
  description:
    "Multi-column site footer with brand, tagline, social links, up to 4 link columns, and a bottom copyright bar.",
  category: "footer",
  useCases: [
    "marketing site footer",
    "SaaS app footer",
    "landing page footer",
    "documentation site footer",
  ],
  supportedPersonas: "all",
  motionPresets: [],
  tags: ["footer", "navigation", "marketing", "multi-column", "brand"],
  available: true,
};

FooterMulti.displayName = "FooterMulti";
