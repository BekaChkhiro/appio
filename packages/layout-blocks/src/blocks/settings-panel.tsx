import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  Card,
  CardContent,
  cardReveal,
  listStagger,
  useAnimationPreset,
  useStaggerPreset,
} from "@appio/ui";
import { cn } from "../lib/utils";
import type { BlockMetadata } from "../types";

export interface SettingsPanelSection {
  /** Stable ID — used as React key + ARIA id for the section heading. */
  id: string;
  /** Section heading — "Profile", "Notifications", "Danger zone". */
  title: string;
  /**
   * Supporting description rendered below the title. Explain *why* the
   * settings here matter, not what each field does — field-level help
   * belongs next to the field.
   */
  description?: string;
  /**
   * The form content. Consumers pass any JSX — typically `Input`, `Label`,
   * `Switch` composed together. The block wraps everything in a Card and
   * handles spacing; consumer controls the exact layout of inputs.
   */
  children: ReactNode;
  /**
   * Optional footer slot — use for per-section save buttons or destructive
   * actions. Rendered with a top border separator.
   */
  footer?: ReactNode;
  /**
   * When `true`, section styling uses the destructive palette — red border
   * + destructive-tinted heading. Use for "Delete account", "Revoke access".
   */
  danger?: boolean;
}

export interface SettingsPanelProps {
  /** Optional page heading above all sections. */
  heading?: string;
  /** Optional supporting copy under the heading. */
  description?: string;
  /** Settings sections. Each renders as its own Card. */
  sections: readonly SettingsPanelSection[];
  /**
   * Layout variant. `split` (default) puts title/description in a left
   * column and form content in a right column on `md:+`. `stacked` keeps
   * title above content on all breakpoints — useful when descriptions are
   * long and you want maximum width for inputs.
   */
  layout?: "split" | "stacked";
  /** Extra classes merged into the outer section. */
  className?: string;
}

/**
 * Sectioned settings page. Each section is a Card with title +
 * description + form-content slot. Page heading reveals via `cardReveal`;
 * sections stagger in via `listStagger` so the viewport fills top-down
 * rather than all at once (a full settings page can have 6+ sections).
 *
 * The block owns vertical rhythm + typography hierarchy; consumers own the
 * form inputs themselves. Pass `<Label>`/`<Input>` from `@appio/ui` into
 * `children` for persona-aware field styling.
 */
export function SettingsPanel(props: SettingsPanelProps) {
  const {
    heading,
    description,
    sections,
    layout = "split",
    className,
  } = props;

  const headerReveal = useAnimationPreset(cardReveal);
  const sectionStagger = useStaggerPreset(listStagger);

  return (
    <section
      className={cn(
        "w-full bg-background py-10 text-foreground md:py-16",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-4xl px-6">
        {(heading !== undefined || description !== undefined) && (
          <motion.header
            className="mb-10"
            initial="initial"
            animate="animate"
            variants={headerReveal.variants}
            transition={headerReveal.transition}
          >
            {heading !== undefined && (
              <h1
                className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
                style={{ fontFamily: "var(--font-heading, inherit)" }}
              >
                {heading}
              </h1>
            )}
            {description !== undefined && (
              <p className="mt-2 text-sm text-muted-foreground md:text-base">
                {description}
              </p>
            )}
          </motion.header>
        )}

        <motion.div
          className="space-y-6"
          initial="initial"
          animate="animate"
          variants={sectionStagger.variants}
        >
          {sections.map((section) => (
            <motion.div key={section.id} variants={sectionStagger.itemVariants}>
              <SettingsSection section={section} layout={layout} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function SettingsSection({
  section,
  layout,
}: {
  section: SettingsPanelSection;
  layout: "split" | "stacked";
}) {
  const dangerClasses = section.danger === true ? "border-destructive/40" : "";
  const titleClasses =
    section.danger === true ? "text-destructive" : "text-foreground";

  const headerBlock = (
    <div className={cn("space-y-1", layout === "split" ? "md:pr-6" : "")}>
      <h2
        id={`settings-${section.id}-title`}
        className={cn(
          "text-base font-semibold tracking-tight",
          titleClasses,
        )}
        style={{ fontFamily: "var(--font-heading, inherit)" }}
      >
        {section.title}
      </h2>
      {section.description !== undefined && (
        <p className="text-sm text-muted-foreground">{section.description}</p>
      )}
    </div>
  );

  const bodyBlock = (
    <div className="space-y-4">
      <div aria-labelledby={`settings-${section.id}-title`}>
        {section.children}
      </div>
      {section.footer !== undefined && (
        <div className="border-t border-border pt-4">{section.footer}</div>
      )}
    </div>
  );

  return (
    <Card className={cn("overflow-hidden", dangerClasses)}>
      <CardContent className="p-6">
        {layout === "split" ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            {headerBlock}
            {bodyBlock}
          </div>
        ) : (
          <div className="space-y-5">
            {headerBlock}
            {bodyBlock}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const settingsPanelMetadata: BlockMetadata = {
  id: "settings-panel",
  name: "Settings Panel",
  description:
    "Sectioned settings page with per-section title, description, form content slot, and optional footer. Split layout on desktop, stacked on mobile.",
  category: "settings",
  useCases: [
    "user account settings",
    "app preferences",
    "workspace configuration",
    "admin settings page",
  ],
  supportedPersonas: "all",
  motionPresets: ["cardReveal", "listStagger"],
  tags: ["settings", "form", "account", "preferences"],
  available: true,
};

SettingsPanel.displayName = "SettingsPanel";
