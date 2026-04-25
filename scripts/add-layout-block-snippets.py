#!/usr/bin/env python3
"""Append RAG snippets for the 15 @appio/layout-blocks to snippets.json.

Idempotent: re-running strips any previous `layout_blocks` entries before
appending the fresh set. This keeps snippet bodies in sync with the block
implementations without leaving stale versions.
"""

import json
from pathlib import Path

SNIPPETS_PATH = Path(__file__).resolve().parents[1] / "packages" / "prompts" / "rag" / "snippets.json"

BLOCK_SNIPPETS = [
    {
        "category": "layout_blocks",
        "title": "HeroCentered — centered marketing hero",
        "content": (
            "Full-width centered hero with eyebrow → headline → subheadline → CTA pair. "
            "Use when the user asks for a landing page, marketing hero, or homepage top section.\n\n"
            "```tsx\n"
            "import { HeroCentered } from \"@appio/layout-blocks\";\n\n"
            "<HeroCentered\n"
            "  eyebrow=\"New\"\n"
            "  headline=\"Build apps by describing them\"\n"
            "  subheadline=\"Turn plain-English ideas into production PWAs.\"\n"
            "  primaryAction={{ label: \"Get started\", href: \"/signup\" }}\n"
            "  secondaryAction={{ label: \"Watch demo\", onClick: () => setOpen(true) }}\n"
            "/>\n"
            "```\n\n"
            "Sizes: `compact` (secondary sections), `default`, `full` (80vh takeover). "
            "Animates in via `cardReveal` — do NOT wrap in another motion container."
        ),
        "tags": ["hero-centered", "landing-page", "marketing", "hero", "cta", "layout-blocks"],
    },
    {
        "category": "layout_blocks",
        "title": "HeroSplit — two-column hero with visual slot",
        "content": (
            "Copy on one side, visual (image/illustration/screenshot) on the other. Stacks on mobile — "
            "visual always lands below copy on small screens so the CTA stays above the fold.\n\n"
            "```tsx\n"
            "import { HeroSplit } from \"@appio/layout-blocks\";\n\n"
            "<HeroSplit\n"
            "  headline=\"Your product in 30 seconds\"\n"
            "  subheadline=\"Show, don't tell.\"\n"
            "  primaryAction={{ label: \"Try it\", href: \"/app\" }}\n"
            "  visual={<img src=\"/screenshot.png\" alt=\"\" className=\"w-full\" />}\n"
            "  copySide=\"left\"\n"
            "/>\n"
            "```\n\n"
            "Use for product-focused marketing pages with a visual anchor. Animates via `cardReveal` + `listStagger` on the CTA group."
        ),
        "tags": ["hero-split", "landing-page", "marketing", "two-column", "product", "layout-blocks"],
    },
    {
        "category": "layout_blocks",
        "title": "FeatureGrid — responsive feature card grid",
        "content": (
            "Grid of icon + title + description cards. Use for \"what's included\" / benefits / capabilities sections.\n\n"
            "```tsx\n"
            "import { FeatureGrid } from \"@appio/layout-blocks\";\n"
            "import { Zap, Shield } from \"lucide-react\";\n\n"
            "<FeatureGrid\n"
            "  heading=\"Everything you need\"\n"
            "  columns={3}\n"
            "  items={[\n"
            "    { icon: <Zap className=\"h-5 w-5\"/>, title: \"Fast\", description: \"500ms builds.\" },\n"
            "    { icon: <Shield className=\"h-5 w-5\"/>, title: \"Secure\", description: \"Hardware isolation.\" },\n"
            "  ]}\n"
            "/>\n"
            "```\n\n"
            "Columns: 2, 3, or 4. Items stagger in via `listStagger`. Add `href` to make a whole card a link."
        ),
        "tags": ["feature-grid", "features", "benefits", "landing-page", "grid", "layout-blocks"],
    },
    {
        "category": "layout_blocks",
        "title": "Testimonials — quote card grid",
        "content": (
            "Grid of testimonial cards — quote + author + role + optional avatar. Typography uses the persona's heading font for the quote itself so editorial personas render proper pullquotes.\n\n"
            "```tsx\n"
            "import { Testimonials } from \"@appio/layout-blocks\";\n\n"
            "<Testimonials\n"
            "  heading=\"Loved by teams\"\n"
            "  items={[\n"
            "    { quote: \"Game-changing.\", authorName: \"Alex Chen\", authorRole: \"CTO, Acme\" },\n"
            "    { quote: \"We shipped in a day.\", authorName: \"Sam Rivera\", authorRole: \"PM, Beta Co\" },\n"
            "  ]}\n"
            "  columns={2}\n"
            "/>\n"
            "```\n\n"
            "Pair with `HeroCentered` above and `FooterMulti` below for a classic landing-page composition."
        ),
        "tags": ["testimonials", "social-proof", "quotes", "landing-page", "reviews", "layout-blocks"],
    },
    {
        "category": "layout_blocks",
        "title": "FooterMulti — multi-column site footer",
        "content": (
            "Brand + tagline + social icons on the left, up to 4 link columns on the right, copyright + bottom links at the bottom.\n\n"
            "```tsx\n"
            "import { FooterMulti } from \"@appio/layout-blocks\";\n\n"
            "<FooterMulti\n"
            "  brand={<span className=\"text-lg font-bold\">Appio</span>}\n"
            "  tagline=\"Build apps with words.\"\n"
            "  linkColumns={[\n"
            "    { heading: \"Product\", links: [{ label: \"Features\", href: \"/features\" }] },\n"
            "    { heading: \"Company\", links: [{ label: \"About\", href: \"/about\" }] },\n"
            "  ]}\n"
            "  copyright=\"© 2026 Appio\"\n"
            "  bottomLinks={[{ label: \"Privacy\", href: \"/privacy\" }]}\n"
            "/>\n"
            "```\n\n"
            "Non-animated by design — site footers should feel grounded, not slide in."
        ),
        "tags": ["footer-multi", "footer", "navigation", "brand", "links", "layout-blocks"],
    },
    {
        "category": "layout_blocks",
        "title": "DashboardStats — KPI card row with trend deltas",
        "content": (
            "Row of stat cards: label + big value + optional delta with trend direction. Trend colors are universal (green/red/muted) regardless of persona — users expect traffic-light semantics on dashboards.\n\n"
            "```tsx\n"
            "import { DashboardStats } from \"@appio/layout-blocks\";\n\n"
            "<DashboardStats\n"
            "  heading=\"This week\"\n"
            "  items={[\n"
            "    { label: \"Revenue\", value: \"$12,340\", delta: \"+12%\", trend: \"up\" },\n"
            "    { label: \"Churn\", value: \"2.1%\", delta: \"-0.3 pts\", trend: \"down\", invertTrend: true },\n"
            "  ]}\n"
            "/>\n"
            "```\n\n"
            "Set `invertTrend: true` when down=good (churn, latency, error rate) — the arrow still points down but the color goes green."
        ),
        "tags": ["dashboard-stats", "dashboard", "metrics", "kpi", "analytics", "layout-blocks"],
    },
    {
        "category": "layout_blocks",
        "title": "SettingsPanel — sectioned form layout",
        "content": (
            "Sectioned settings page. Each section is a Card with title + description + form-content slot + optional footer. Split layout on desktop (title left / inputs right), stacked on mobile.\n\n"
            "```tsx\n"
            "import { SettingsPanel } from \"@appio/layout-blocks\";\n"
            "import { Input, Label, Button } from \"@appio/ui\";\n\n"
            "<SettingsPanel\n"
            "  heading=\"Account\"\n"
            "  sections={[\n"
            "    {\n"
            "      id: \"profile\",\n"
            "      title: \"Profile\",\n"
            "      description: \"How others see you.\",\n"
            "      children: <div><Label>Name</Label><Input /></div>,\n"
            "    },\n"
            "    {\n"
            "      id: \"danger\",\n"
            "      title: \"Delete account\",\n"
            "      danger: true,\n"
            "      children: <Button variant=\"danger\">Delete</Button>,\n"
            "    },\n"
            "  ]}\n"
            "/>\n"
            "```\n\n"
            "Use `danger: true` on destructive sections for red-tinted styling."
        ),
        "tags": ["settings-panel", "settings", "form", "account", "preferences", "layout-blocks"],
    },
    {
        "category": "layout_blocks",
        "title": "PricingTable — tiered pricing cards",
        "content": (
            "Multi-tier pricing cards: name + price + feature list + per-tier CTA. Set `highlighted: true` on the recommended tier for primary ring + \"Most popular\" badge.\n\n"
            "```tsx\n"
            "import { PricingTable } from \"@appio/layout-blocks\";\n\n"
            "<PricingTable\n"
            "  heading=\"Simple pricing\"\n"
            "  tiers={[\n"
            "    {\n"
            "      id: \"free\", name: \"Free\", price: \"$0\", period: \"/ mo\",\n"
            "      features: [{ label: \"3 apps\" }, { label: \"Custom domains\", included: false }],\n"
            "      cta: { label: \"Get started\", href: \"/signup\" },\n"
            "    },\n"
            "    {\n"
            "      id: \"pro\", name: \"Pro\", price: \"$12\", period: \"/ mo\",\n"
            "      highlighted: true,\n"
            "      features: [{ label: \"Unlimited apps\" }, { label: \"Team seats\", included: \"pending\", hint: \"Coming Q3\" }],\n"
            "      cta: { label: \"Start trial\", href: \"/signup?plan=pro\" },\n"
            "    },\n"
            "  ]}\n"
            "/>\n"
            "```\n\n"
            "Features: `included: true` (check), `false` (X + strikethrough), `\"pending\"` (muted check for \"coming soon\")."
        ),
        "tags": ["pricing-table", "pricing", "tiers", "subscription", "plans", "layout-blocks"],
    },
    {
        "category": "layout_blocks",
        "title": "LoginCard — auth with OAuth + email/password",
        "content": (
            "Auth card with OAuth provider buttons + email form + forgot-password link + signup prompt. Handles pending/error state internally — just wire the handlers.\n\n"
            "```tsx\n"
            "import { LoginCard } from \"@appio/layout-blocks\";\n\n"
            "<LoginCard\n"
            "  heading=\"Welcome back\"\n"
            "  oauthProviders={[\n"
            "    { id: \"google\", label: \"Continue with Google\", icon: <GoogleIcon/>, onClick: signInGoogle },\n"
            "  ]}\n"
            "  onEmailSubmit={async ({ email, password }) => { await signIn(email, password); }}\n"
            "  forgotPasswordHref=\"/forgot\"\n"
            "  signupPrompt={{ text: \"New here?\", linkLabel: \"Sign up\", href: \"/signup\" }}\n"
            "  errorMessage={authError ?? undefined}\n"
            "/>\n"
            "```\n\n"
            "Centered on the viewport by default. Set `errorMessage` to show an alert above the form."
        ),
        "tags": ["login-card", "auth", "login", "signin", "oauth", "layout-blocks"],
    },
    {
        "category": "layout_blocks",
        "title": "OnboardingStepper — multi-step wizard with progress indicator",
        "content": (
            "Multi-step flow with step dots + per-step content + Back/Next navigation. Controlled — consumer owns `currentStepIndex`.\n\n"
            "```tsx\n"
            "import { OnboardingStepper } from \"@appio/layout-blocks\";\n\n"
            "const [step, setStep] = useState(0);\n\n"
            "<OnboardingStepper\n"
            "  currentStepIndex={step}\n"
            "  onNext={() => setStep(step + 1)}\n"
            "  onBack={() => setStep(step - 1)}\n"
            "  onComplete={() => router.push(\"/dashboard\")}\n"
            "  steps={[\n"
            "    { id: \"name\", label: \"Name\", content: <NameForm/> },\n"
            "    { id: \"ws\", label: \"Workspace\", content: <WorkspaceForm/>, nextDisabled: !wsValid },\n"
            "  ]}\n"
            "/>\n"
            "```\n\n"
            "Use `nextDisabled` per-step for validation gating. Animates with `pageTransition` on step change."
        ),
        "tags": ["onboarding-stepper", "onboarding", "wizard", "stepper", "setup", "layout-blocks"],
    },
    {
        "category": "layout_blocks",
        "title": "MarketplaceGrid — product/listing catalog grid",
        "content": (
            "Grid of cards: image + title + price + optional badge + optional rating. Optional filter chip row above.\n\n"
            "```tsx\n"
            "import { MarketplaceGrid } from \"@appio/layout-blocks\";\n\n"
            "<MarketplaceGrid\n"
            "  heading=\"Templates\"\n"
            "  filters={[\n"
            "    { id: \"all\", label: \"All\", active: true, onClick: () => setFilter(\"all\") },\n"
            "    { id: \"productivity\", label: \"Productivity\", onClick: () => setFilter(\"productivity\") },\n"
            "  ]}\n"
            "  items={items.map(i => ({\n"
            "    id: i.id, title: i.name, subtitle: i.blurb,\n"
            "    price: i.price, imageUrl: i.cover,\n"
            "    rating: i.rating, ratingCount: i.reviews,\n"
            "    href: `/templates/${i.id}`,\n"
            "  }))}\n"
            "  columns={3}\n"
            "/>\n"
            "```\n\n"
            "Cards lift on hover. Empty state renders when `items` is empty — override via `emptyState` prop."
        ),
        "tags": ["marketplace-grid", "marketplace", "catalog", "ecommerce", "products", "grid", "layout-blocks"],
    },
    {
        "category": "layout_blocks",
        "title": "ProfileCard — user profile surface",
        "content": (
            "Cover banner → avatar → name + role → bio → stats row → actions. Max-width ~500px; scales down to mobile.\n\n"
            "```tsx\n"
            "import { ProfileCard } from \"@appio/layout-blocks\";\n\n"
            "<ProfileCard\n"
            "  coverUrl=\"/covers/abstract.jpg\"\n"
            "  avatarUrl={user.avatarUrl}\n"
            "  name={user.name}\n"
            "  role={user.title}\n"
            "  badge={user.plan === \"pro\" ? \"Pro\" : undefined}\n"
            "  bio={user.bio}\n"
            "  stats={[\n"
            "    { label: \"Apps\", value: user.appCount },\n"
            "    { label: \"Followers\", value: formatCount(user.followers) },\n"
            "  ]}\n"
            "  primaryAction={{ label: \"Follow\", onClick: follow }}\n"
            "  secondaryAction={{ label: \"Message\", onClick: openDm }}\n"
            "/>\n"
            "```\n\n"
            "For in-header \"current user\" summaries prefer a custom composition — this block's footprint assumes the profile IS the page."
        ),
        "tags": ["profile-card", "profile", "user", "avatar", "bio", "team", "layout-blocks"],
    },
    {
        "category": "layout_blocks",
        "title": "FaqAccordion — expandable FAQ list",
        "content": (
            "Expandable Q&A list with smooth height animation. `mode=\"single\"` (default) keeps one open at a time; `mode=\"multiple\"` allows independent toggling.\n\n"
            "```tsx\n"
            "import { FaqAccordion } from \"@appio/layout-blocks\";\n\n"
            "<FaqAccordion\n"
            "  heading=\"Questions?\"\n"
            "  mode=\"single\"\n"
            "  defaultOpenIds={[\"free-plan\"]}\n"
            "  items={[\n"
            "    { id: \"free-plan\", question: \"Is there a free plan?\", answer: \"Yes — 3 apps, unlimited previews.\" },\n"
            "    { id: \"export\", question: \"Can I export my code?\", answer: \"Every published app ships with full source.\" },\n"
            "  ]}\n"
            "/>\n"
            "```\n\n"
            "Answers accept JSX — include links, lists, code snippets in answers freely. Keyboard accessible (Tab + Enter/Space)."
        ),
        "tags": ["faq-accordion", "faq", "help", "accordion", "support", "layout-blocks"],
    },
    {
        "category": "layout_blocks",
        "title": "EmptyStateIllustrated — illustration + CTA for empty views",
        "content": (
            "Illustration slot + heading + description + optional CTA pair. Use when a data view has no items and the absence is meaningful. NOT for loading states (use Skeleton there).\n\n"
            "```tsx\n"
            "import { EmptyStateIllustrated } from \"@appio/layout-blocks\";\n"
            "import { Inbox } from \"lucide-react\";\n\n"
            "<EmptyStateIllustrated\n"
            "  illustration={<Inbox className=\"h-16 w-16\"/>}\n"
            "  heading=\"No apps yet\"\n"
            "  description=\"Describe an app in the chat to get started.\"\n"
            "  primaryAction={{ label: \"Create your first app\", href: \"/create\" }}\n"
            "  secondaryAction={{ label: \"Browse templates\", href: \"/templates\" }}\n"
            "/>\n"
            "```\n\n"
            "Sizes: `default` (min-h-60vh, page-scale) and `compact` (inline, for section-scale empty states)."
        ),
        "tags": ["empty-state-illustrated", "empty-state", "illustration", "no-data", "onboarding", "layout-blocks"],
    },
    {
        "category": "layout_blocks",
        "title": "CommandPalette — ⌘K-style searchable launcher",
        "content": (
            "Dialog-based command palette with grouped results, keyboard navigation (↑↓ Enter Esc), and keyword matching. Controlled open state.\n\n"
            "```tsx\n"
            "import { CommandPalette } from \"@appio/layout-blocks\";\n\n"
            "const [open, setOpen] = useState(false);\n\n"
            "// Global ⌘K / Ctrl+K shortcut\n"
            "useEffect(() => {\n"
            "  const handler = (e: KeyboardEvent) => {\n"
            "    if ((e.metaKey || e.ctrlKey) && e.key === \"k\") { e.preventDefault(); setOpen(o => !o); }\n"
            "  };\n"
            "  window.addEventListener(\"keydown\", handler);\n"
            "  return () => window.removeEventListener(\"keydown\", handler);\n"
            "}, []);\n\n"
            "<CommandPalette\n"
            "  open={open}\n"
            "  onOpenChange={setOpen}\n"
            "  groups={[\n"
            "    {\n"
            "      id: \"nav\", heading: \"Navigation\",\n"
            "      items: [\n"
            "        { id: \"home\", label: \"Go Home\", shortcut: \"⌘H\", onSelect: () => router.push(\"/\") },\n"
            "        { id: \"apps\", label: \"My Apps\", keywords: [\"apps\", \"projects\"], onSelect: () => router.push(\"/apps\") },\n"
            "      ],\n"
            "    },\n"
            "  ]}\n"
            "/>\n"
            "```\n\n"
            "Items match against `label` + `description` + `keywords`. Closes on select by default — set `closeOnSelect={false}` for multi-action flows."
        ),
        "tags": ["command-palette", "cmdk", "search", "keyboard", "navigation", "quick-actions", "layout-blocks"],
    },
]


def main() -> None:
    data = json.loads(SNIPPETS_PATH.read_text())
    # Strip any existing layout_blocks entries so the script is idempotent.
    filtered = [s for s in data if s.get("category") != "layout_blocks"]
    filtered.extend(BLOCK_SNIPPETS)
    SNIPPETS_PATH.write_text(json.dumps(filtered, indent=2, ensure_ascii=False) + "\n")
    print(
        f"Wrote {len(filtered)} snippets to {SNIPPETS_PATH.relative_to(Path.cwd())} "
        f"({len(filtered) - len(BLOCK_SNIPPETS)} existing + {len(BLOCK_SNIPPETS)} layout_blocks)."
    )


if __name__ == "__main__":
    main()
