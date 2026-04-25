import { useCallback, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import type { BlockMetadata } from "../types";

export interface FaqItem {
  /** Stable ID — used as React key + ARIA panel id. */
  id: string;
  /** Question text. */
  question: string;
  /**
   * Answer content. Accepts plain text or JSX (links, lists, code snippets
   * in answers are common). Multi-paragraph answers work fine.
   */
  answer: ReactNode;
}

export interface FaqAccordionProps {
  /** Optional section heading. */
  heading?: string;
  /** Optional supporting copy under the heading. */
  description?: string;
  /** FAQ items. Order matters — most-asked first. */
  items: readonly FaqItem[];
  /**
   * Expansion mode. `single` (default) — only one item open at a time; opening
   * a new one collapses the previous. `multiple` — items toggle independently.
   */
  mode?: "single" | "multiple";
  /**
   * Default-expanded item IDs. In `single` mode, only the first matching ID
   * applies. Uncontrolled — the component owns its own expansion state after
   * mount.
   */
  defaultOpenIds?: readonly string[];
  /** Extra classes merged into the outer section. */
  className?: string;
}

/**
 * Expandable FAQ list. Uses controlled internal state + `AnimatePresence`
 * with height interpolation — the answer smoothly slides open/shut rather
 * than jumping, which matters a lot for FAQ UX (users scroll past closed
 * items visually measuring what's there).
 *
 * Uncontrolled component — the block owns expansion state. For cases that
 * need external sync (URL hash-linked FAQ, "expand all" button elsewhere),
 * a controlled variant would need a separate API; not covered here.
 *
 * Keyboard: Enter and Space toggle the focused item's panel. Tab moves
 * between questions. Focus ring uses the persona's `ring` token.
 */
export function FaqAccordion(props: FaqAccordionProps) {
  const {
    heading,
    description,
    items,
    mode = "single",
    defaultOpenIds = [],
    className,
  } = props;

  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (mode === "single") {
      const first = defaultOpenIds[0];
      if (first !== undefined) initial.add(first);
    } else {
      for (const id of defaultOpenIds) initial.add(id);
    }
    return initial;
  });

  const toggle = useCallback(
    (id: string) => {
      setOpenIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          if (mode === "single") next.clear();
          next.add(id);
        }
        return next;
      });
    },
    [mode],
  );

  return (
    <section
      className={cn(
        "w-full bg-background py-16 text-foreground md:py-20",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-3xl px-6">
        {(heading !== undefined || description !== undefined) && (
          <header className="mb-10 text-center">
            {heading !== undefined && (
              <h2
                className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
                style={{ fontFamily: "var(--font-heading, inherit)" }}
              >
                {heading}
              </h2>
            )}
            {description !== undefined && (
              <p className="mt-3 text-base text-muted-foreground">
                {description}
              </p>
            )}
          </header>
        )}

        <ul className="flex list-none flex-col gap-2 p-0">
          {items.map((item) => (
            <li key={item.id}>
              <FaqRow
                item={item}
                open={openIds.has(item.id)}
                onToggle={() => toggle(item.id)}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FaqRow({
  item,
  open,
  onToggle,
}: {
  item: FaqItem;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = `faq-${item.id}-panel`;
  const buttonId = `faq-${item.id}-trigger`;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card transition-colors hover:bg-accent/40">
      <button
        id={buttonId}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left outline-none ring-ring focus-visible:ring-2"
      >
        <span
          className="text-base font-medium text-foreground"
          style={{ fontFamily: "var(--font-heading, inherit)" }}
        >
          {item.question}
        </span>
        <motion.span
          aria-hidden
          className="shrink-0 text-muted-foreground"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0.0, 0.2, 1] }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0.0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
              {item.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const faqAccordionMetadata: BlockMetadata = {
  id: "faq-accordion",
  name: "FAQ Accordion",
  description:
    "Expandable FAQ list with smooth height animations and keyboard navigation. Single or multiple open at once.",
  category: "content",
  useCases: [
    "FAQ section",
    "help page",
    "support answers",
    "pricing page FAQ",
  ],
  supportedPersonas: "all",
  motionPresets: [],
  tags: ["faq", "accordion", "help", "expandable", "content"],
  available: true,
};

FaqAccordion.displayName = "FaqAccordion";
