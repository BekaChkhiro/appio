"use client";

import type { ReactNode } from "react";
import {
  Bell,
  Code,
  Command as CommandIcon,
  Inbox,
  Mail,
  Search,
  Settings,
  Shield,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { Input, Label } from "@appio/ui";
import type { BlockId } from "@appio/layout-blocks";
import {
  HeroCentered,
  HeroSplit,
  FeatureGrid,
  Testimonials,
  FooterMulti,
  DashboardStats,
  SettingsPanel,
  PricingTable,
  LoginCard,
  OnboardingStepper,
  MarketplaceGrid,
  ProfileCard,
  FaqAccordion,
  EmptyStateIllustrated,
} from "@appio/layout-blocks";

export interface SampleBlock {
  id: BlockId;
  /** Human-readable name shown in the gallery. */
  label: string;
  /** Category shown next to the label. */
  category: string;
  /**
   * Fully-prepared JSX. Declared as a function so interactive blocks that
   * manage state internally can instantiate cleanly per render of the
   * enclosing persona scope.
   */
  render: () => ReactNode;
}

function InboxIllustration() {
  return <Inbox className="h-16 w-16" />;
}

/**
 * Inline-preview for CommandPalette. The real `CommandPalette` is a Dialog
 * that needs click-to-open — for the gallery we render a static mock of
 * the palette's visible surface so all 5 personas can be inspected
 * side-by-side without each requiring a modal toggle.
 */
function CommandPaletteInlinePreview() {
  return (
    <div className="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-background shadow-xl">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex-1 text-base text-muted-foreground">
          Search commands…
        </div>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          esc
        </kbd>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-2">
        <div className="mb-2">
          <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Navigation
          </div>
          <ul className="flex list-none flex-col gap-0.5 p-0">
            <li>
              <div className="flex w-full items-center gap-3 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
                <CommandIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 font-medium">Go to Home</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  ⌘H
                </kbd>
              </div>
            </li>
            <li>
              <div className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 font-medium">My Apps</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  ⌘M
                </kbd>
              </div>
            </li>
          </ul>
        </div>
        <div>
          <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Actions
          </div>
          <ul className="flex list-none flex-col gap-0.5 p-0">
            <li>
              <div className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground">
                <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 font-medium">Create app</span>
              </div>
            </li>
            <li>
              <div className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground">
                <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 font-medium">Settings</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export const sampleBlocks: readonly SampleBlock[] = [
  {
    id: "hero-centered",
    label: "HeroCentered",
    category: "hero",
    render: () => (
      <HeroCentered
        eyebrow="New"
        headline="Build apps by describing them"
        subheadline="Turn plain-English ideas into production PWAs in minutes. No code required."
        primaryAction={{ label: "Get started", href: "#" }}
        secondaryAction={{ label: "Watch demo", href: "#" }}
      />
    ),
  },
  {
    id: "hero-split",
    label: "HeroSplit",
    category: "hero",
    render: () => (
      <HeroSplit
        eyebrow="Preview"
        headline="Your product in 30 seconds"
        subheadline="See what your app looks like before you write a single line of code."
        primaryAction={{ label: "Try it", href: "#" }}
        secondaryAction={{ label: "See pricing", href: "#" }}
        visual={
          <div
            aria-hidden
            className="aspect-video w-full bg-gradient-to-br from-primary/30 via-accent to-muted"
          />
        }
      />
    ),
  },
  {
    id: "feature-grid",
    label: "FeatureGrid",
    category: "feature",
    render: () => (
      <FeatureGrid
        eyebrow="Everything included"
        heading="Batteries, not wires"
        description="Every app ships with what you need on day one."
        columns={3}
        items={[
          {
            icon: <Zap className="h-5 w-5" />,
            title: "Fast builds",
            description: "esbuild + Tailwind under 500ms per build.",
          },
          {
            icon: <Shield className="h-5 w-5" />,
            title: "Hardware isolation",
            description: "Each generation runs in its own Firecracker microVM.",
          },
          {
            icon: <Sparkles className="h-5 w-5" />,
            title: "Persona-aware design",
            description: "5 curated theme personas — no generic shadcn look.",
          },
        ]}
      />
    ),
  },
  {
    id: "testimonials",
    label: "Testimonials",
    category: "social-proof",
    render: () => (
      <Testimonials
        eyebrow="Loved by builders"
        heading="Shipping faster, together"
        items={[
          {
            quote:
              "I described my internal tool in one paragraph. Ten minutes later I was installing the PWA on my phone.",
            authorName: "Sam Rivera",
            authorRole: "PM, Beta Co",
          },
          {
            quote:
              "The theme personas make every generated app feel intentional — not a shadcn clone.",
            authorName: "Alex Chen",
            authorRole: "Designer, Linear",
          },
          {
            quote:
              "Publish flow is genuinely magic. Convex deploy key paste → live production app.",
            authorName: "Jordan Lee",
            authorRole: "Founder, Ship Fast",
          },
        ]}
      />
    ),
  },
  {
    id: "footer-multi",
    label: "FooterMulti",
    category: "footer",
    render: () => (
      <FooterMulti
        brand={<span className="text-lg font-semibold text-foreground">Appio</span>}
        tagline="Build apps with words. Ship in minutes."
        linkColumns={[
          {
            heading: "Product",
            links: [
              { label: "Features", href: "#" },
              { label: "Templates", href: "#" },
              { label: "Pricing", href: "#" },
            ],
          },
          {
            heading: "Company",
            links: [
              { label: "About", href: "#" },
              { label: "Blog", href: "#" },
              { label: "Careers", href: "#" },
            ],
          },
          {
            heading: "Resources",
            links: [
              { label: "Docs", href: "#" },
              { label: "API", href: "#" },
              { label: "Status", href: "#", external: true },
            ],
          },
        ]}
        copyright="© 2026 Appio, Inc."
        bottomLinks={[
          { label: "Privacy", href: "#" },
          { label: "Terms", href: "#" },
        ]}
      />
    ),
  },
  {
    id: "dashboard-stats",
    label: "DashboardStats",
    category: "dashboard",
    render: () => (
      <DashboardStats
        heading="This week"
        description="Key metrics across all published apps."
        items={[
          {
            label: "Revenue",
            value: "$12,340",
            delta: "+12% vs last week",
            trend: "up",
          },
          {
            label: "Active users",
            value: "1,284",
            delta: "+8% MoM",
            trend: "up",
            icon: <User className="h-4 w-4" />,
          },
          {
            label: "Churn",
            value: "2.1%",
            delta: "-0.3 pts",
            trend: "down",
            invertTrend: true,
          },
          {
            label: "Errors",
            value: "14",
            delta: "flat vs last week",
            trend: "flat",
          },
        ]}
      />
    ),
  },
  {
    id: "settings-panel",
    label: "SettingsPanel",
    category: "settings",
    render: () => (
      <SettingsPanel
        heading="Account settings"
        description="Manage how you sign in and appear across Appio."
        sections={[
          {
            id: "profile",
            title: "Profile",
            description: "How others see you in comments and team views.",
            children: (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gallery-name">Display name</Label>
                  <Input id="gallery-name" defaultValue="Alex Chen" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gallery-bio">Bio</Label>
                  <Input id="gallery-bio" defaultValue="Building tools for makers" />
                </div>
              </div>
            ),
          },
          {
            id: "notifications",
            title: "Notifications",
            description:
              "Choose what you get pinged about. You can still visit the notifications page for more detail.",
            children: (
              <ul className="space-y-2 text-sm text-foreground">
                <li className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  Weekly summary email
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Deploy failure alerts
                </li>
              </ul>
            ),
          },
        ]}
      />
    ),
  },
  {
    id: "pricing-table",
    label: "PricingTable",
    category: "pricing",
    render: () => (
      <PricingTable
        heading="Simple, honest pricing"
        description="Start free. Pay only when you ship to production."
        tiers={[
          {
            id: "free",
            name: "Free",
            price: "$0",
            period: "/ month",
            description: "For tinkering and personal projects.",
            features: [
              { label: "3 active apps" },
              { label: "Unlimited previews" },
              { label: "Community support" },
              { label: "Custom domains", included: false },
            ],
            cta: { label: "Get started", href: "#" },
          },
          {
            id: "pro",
            name: "Pro",
            price: "$12",
            period: "/ month",
            description: "For makers shipping real products.",
            highlighted: true,
            features: [
              { label: "Unlimited apps" },
              { label: "Custom domains" },
              { label: "Priority support" },
              { label: "Team collaboration", included: "pending", hint: "Coming Q3" },
            ],
            cta: { label: "Start 14-day trial", href: "#" },
          },
          {
            id: "team",
            name: "Team",
            price: "$49",
            period: "/ seat / mo",
            description: "For teams that build together.",
            features: [
              { label: "Everything in Pro" },
              { label: "SSO / SAML" },
              { label: "Audit log" },
              { label: "Dedicated support" },
            ],
            cta: { label: "Contact sales", href: "#" },
          },
        ]}
      />
    ),
  },
  {
    id: "login-card",
    label: "LoginCard",
    category: "auth",
    render: () => (
      <LoginCard
        heading="Welcome back"
        description="Sign in to pick up where you left off."
        oauthProviders={[
          {
            id: "google",
            label: "Continue with Google",
            icon: <Code className="h-4 w-4" />,
            onClick: () => {},
          },
          {
            id: "github",
            label: "Continue with GitHub",
            icon: <Code className="h-4 w-4" />,
            onClick: () => {},
          },
        ]}
        onEmailSubmit={async () => {}}
        forgotPasswordHref="#"
        signupPrompt={{
          text: "Don't have an account?",
          linkLabel: "Sign up",
          href: "#",
        }}
      />
    ),
  },
  {
    id: "onboarding-stepper",
    label: "OnboardingStepper",
    category: "auth",
    render: () => (
      <OnboardingStepper
        currentStepIndex={1}
        onNext={() => {}}
        onBack={() => {}}
        onSkip={() => {}}
        steps={[
          {
            id: "name",
            label: "Your name",
            content: (
              <p className="text-sm text-muted-foreground">
                Tell us what to call you.
              </p>
            ),
          },
          {
            id: "workspace",
            label: "Workspace",
            content: (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gallery-ws">Workspace name</Label>
                  <Input id="gallery-ws" defaultValue="Ship Fast" />
                </div>
                <p className="text-xs text-muted-foreground">
                  You can change this later in settings.
                </p>
              </div>
            ),
          },
          {
            id: "invite",
            label: "Invite team",
            content: (
              <p className="text-sm text-muted-foreground">
                Skip this if you&apos;ll invite people later.
              </p>
            ),
          },
        ]}
      />
    ),
  },
  {
    id: "marketplace-grid",
    label: "MarketplaceGrid",
    category: "marketplace",
    render: () => (
      <MarketplaceGrid
        heading="Templates"
        description="Start from a ready-made pattern and customize with chat."
        filters={[
          { id: "all", label: "All", active: true, onClick: () => {} },
          { id: "productivity", label: "Productivity", onClick: () => {} },
          { id: "commerce", label: "Commerce", onClick: () => {} },
          { id: "social", label: "Social", onClick: () => {} },
        ]}
        items={[
          {
            id: "todo",
            title: "Todo List",
            subtitle: "Classic task manager with optional Convex sync.",
            price: "Free",
            badge: "Popular",
            rating: 4.8,
            ratingCount: 234,
            href: "#",
          },
          {
            id: "habit",
            title: "Habit Tracker",
            subtitle: "Daily streaks and weekly rollups.",
            price: "Free",
            rating: 4.6,
            ratingCount: 112,
            href: "#",
          },
          {
            id: "expense",
            title: "Expense Tracker",
            subtitle: "Budget, categories, monthly summary.",
            price: "Pro",
            badge: "New",
            rating: 4.9,
            ratingCount: 47,
            href: "#",
          },
        ]}
      />
    ),
  },
  {
    id: "profile-card",
    label: "ProfileCard",
    category: "profile",
    render: () => (
      <div className="flex w-full items-center justify-center bg-background p-10">
        <ProfileCard
          name="Alex Chen"
          role="Product Designer · San Francisco"
          badge="Pro"
          bio="Building delightful tools for makers. Previously at Linear, Figma. Host of Build in Public podcast."
          stats={[
            { label: "Apps", value: 42 },
            { label: "Followers", value: "1.2K" },
            { label: "Rating", value: "4.9" },
          ]}
          primaryAction={{ label: "Follow", onClick: () => {} }}
          secondaryAction={{ label: "Message", onClick: () => {} }}
        />
      </div>
    ),
  },
  {
    id: "faq-accordion",
    label: "FaqAccordion",
    category: "content",
    render: () => (
      <FaqAccordion
        heading="Frequently asked questions"
        description="Can't find what you're looking for? Email support@appio.app."
        defaultOpenIds={["free"]}
        items={[
          {
            id: "free",
            question: "Is there really a free plan?",
            answer:
              "Yes — 3 apps, unlimited previews, and community support. No credit card required to start.",
          },
          {
            id: "export",
            question: "Can I export my code?",
            answer:
              "Every published app ships with full source. You own the code completely — Appio just helps you write it.",
          },
          {
            id: "convex",
            question: "Why Convex for the backend?",
            answer:
              "Real-time by default, no schema drift, and the auth/data/file-storage stack is genuinely tight. For apps that need 50K+ concurrent users you'd migrate to a dedicated deployment — Appio handles that via the Publish flow.",
          },
        ]}
      />
    ),
  },
  {
    id: "empty-state-illustrated",
    label: "EmptyStateIllustrated",
    category: "empty-state",
    render: () => (
      <EmptyStateIllustrated
        illustration={<InboxIllustration />}
        heading="No apps yet"
        description="Describe an app in the chat to get your first one shipped."
        primaryAction={{ label: "Create your first app", href: "#" }}
        secondaryAction={{ label: "Browse templates", href: "#" }}
      />
    ),
  },
  {
    id: "command-palette",
    label: "CommandPalette (inline preview)",
    category: "navigation",
    render: () => (
      <div className="flex min-h-[40vh] items-start justify-center bg-background p-10">
        <CommandPaletteInlinePreview />
      </div>
    ),
  },
];
