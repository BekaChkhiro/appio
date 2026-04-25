import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  cardReveal,
  useAnimationPreset,
} from "@appio/ui";
import { cn } from "../lib/utils";
import type { BlockMetadata } from "../types";
import type { HeroCenteredAction } from "./hero-centered";

export interface ProfileStat {
  /** Metric label — "Followers", "Apps built", "Years". */
  label: string;
  /** Pre-formatted value — "1.2K", "42", "3". */
  value: string | number;
}

export interface ProfileCardProps {
  /**
   * Cover image URL rendered as a banner above the avatar. Omit for a
   * clean "avatar only" profile card that suits admin/team surfaces.
   */
  coverUrl?: string;
  /** Cover accessibility alt text. Defaults to "". */
  coverAlt?: string;
  /** Avatar image URL. Falls back to initials when omitted. */
  avatarUrl?: string;
  /** User's full name — required. */
  name: string;
  /** Role or title — "Product Designer", "Senior Engineer". */
  role?: string;
  /** Optional badge — "Pro", "Admin", "Verified". */
  badge?: string;
  /** Bio — 2-3 sentence description. Long bios truncate at 3 lines. */
  bio?: string;
  /**
   * Stats row — 2-4 items. Renders as a horizontal strip below the bio.
   * Omit entirely for minimal profile cards.
   */
  stats?: readonly ProfileStat[];
  /**
   * Primary action — "Follow", "Hire me", "Message". Typically filled.
   */
  primaryAction?: HeroCenteredAction;
  /** Secondary action — "Share profile", "Copy link". Ghost variant. */
  secondaryAction?: HeroCenteredAction;
  /**
   * Optional custom slot between header and stats. Use for tags, skill
   * chips, social links, or a language selector.
   */
  bodySlot?: ReactNode;
  /** Extra classes merged into the outer card wrapper. */
  className?: string;
}

/**
 * Self-contained user profile card. Stacked layout — cover banner →
 * avatar (overlapping) → name + role → bio → stats → actions. Designed
 * for ~380-500px width; scales down gracefully to mobile width.
 *
 * Use for: team member cards, author bios, user profile pages, public
 * portfolio surfaces. For in-app "current user" summaries in headers,
 * prefer a smaller custom composition — this block's footprint assumes
 * the profile IS the page, not a peripheral widget.
 */
export function ProfileCard(props: ProfileCardProps) {
  const {
    coverUrl,
    coverAlt = "",
    avatarUrl,
    name,
    role,
    badge,
    bio,
    stats,
    primaryAction,
    secondaryAction,
    bodySlot,
    className,
  } = props;

  const reveal = useAnimationPreset(cardReveal);

  const hasStats = stats !== undefined && stats.length > 0;
  const hasActions =
    primaryAction !== undefined || secondaryAction !== undefined;

  return (
    <motion.div
      className={cn("w-full max-w-md", className)}
      initial="initial"
      animate="animate"
      variants={reveal.variants}
      transition={reveal.transition}
    >
      <Card className="overflow-hidden">
        {coverUrl !== undefined ? (
          <div className="relative h-32 w-full bg-muted md:h-40">
            <img
              src={coverUrl}
              alt={coverAlt}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div
            className="h-20 w-full bg-gradient-to-br from-primary/20 via-muted to-accent"
            aria-hidden
          />
        )}

        <CardContent className="relative flex flex-col gap-4 p-6 pt-0">
          <div className="-mt-10 flex items-end justify-between">
            <Avatar className="h-20 w-20 border-4 border-background">
              {avatarUrl !== undefined && (
                <AvatarImage src={avatarUrl} alt={name} />
              )}
              <AvatarFallback className="text-lg font-semibold">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            {badge !== undefined && (
              <Badge variant="secondary">{badge}</Badge>
            )}
          </div>

          <header className="space-y-0.5">
            <h3
              className="text-xl font-semibold tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-heading, inherit)" }}
            >
              {name}
            </h3>
            {role !== undefined && (
              <p className="text-sm text-muted-foreground">{role}</p>
            )}
          </header>

          {bio !== undefined && (
            <p className="line-clamp-3 text-sm leading-relaxed text-foreground/80">
              {bio}
            </p>
          )}

          {bodySlot !== undefined && <div>{bodySlot}</div>}

          {hasStats && (
            <dl className="grid grid-cols-3 gap-4 border-y border-border py-4">
              {stats.slice(0, 4).map((stat) => (
                <div key={stat.label} className="text-center">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {stat.label}
                  </dt>
                  <dd
                    className="mt-1 text-base font-semibold text-foreground"
                    style={{ fontFamily: "var(--font-heading, inherit)" }}
                  >
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {hasActions && (
            <div className="flex gap-2 pt-1">
              {primaryAction !== undefined && (
                <ProfileAction
                  action={primaryAction}
                  variant="default"
                  fullWidth
                />
              )}
              {secondaryAction !== undefined && (
                <ProfileAction action={secondaryAction} variant="outline" />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ProfileAction({
  action,
  variant,
  fullWidth,
}: {
  action: HeroCenteredAction;
  variant: "default" | "outline";
  fullWidth?: boolean;
}) {
  const className = fullWidth === true ? "flex-1" : "";

  if (action.href !== undefined && action.onClick === undefined) {
    return (
      <Button asChild variant={variant} className={className}>
        <a
          href={action.href}
          target={action.external === true ? "_blank" : undefined}
          rel={action.external === true ? "noreferrer" : undefined}
        >
          {action.label}
        </a>
      </Button>
    );
  }
  return (
    <Button variant={variant} className={className} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (
    parts[0]!.charAt(0).toUpperCase() +
    parts[parts.length - 1]!.charAt(0).toUpperCase()
  );
}

export const profileCardMetadata: BlockMetadata = {
  id: "profile-card",
  name: "Profile Card",
  description:
    "User profile card with cover banner, avatar, name, role, badge, bio, stats row, and primary/secondary actions.",
  category: "profile",
  useCases: [
    "user profile page",
    "team member card",
    "author bio card",
    "public portfolio surface",
  ],
  supportedPersonas: "all",
  motionPresets: ["cardReveal"],
  tags: ["profile", "user", "card", "avatar", "bio"],
  available: true,
};

ProfileCard.displayName = "ProfileCard";
