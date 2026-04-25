import { useState, type FormEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  cardReveal,
  useAnimationPreset,
} from "@appio/ui";
import { cn } from "../lib/utils";
import type { BlockMetadata } from "../types";

export interface OAuthProvider {
  /** Stable ID — "google", "apple", "github". Used as React key. */
  id: string;
  /** Visible button label — "Continue with Google". */
  label: string;
  /** Provider icon (16-20px). Typically a brand SVG or `lucide-react` icon. */
  icon: ReactNode;
  /** Called when the provider button is clicked. */
  onClick: () => void | Promise<void>;
}

export interface LoginCardProps {
  /** Main heading — "Welcome back", "Sign in to Appio". */
  heading?: string;
  /** Supporting copy under the heading. */
  description?: string;
  /**
   * Email + password submit handler. Receives the form values; consumer
   * handles validation, auth, and error surfacing. Block keeps submit state
   * internal so the button can show pending UX.
   */
  onEmailSubmit?: (credentials: { email: string; password: string }) => void | Promise<void>;
  /** Label for the email submit button. Defaults to "Sign in". */
  emailSubmitLabel?: string;
  /**
   * OAuth providers rendered as a stack above the email form. Max 4
   * recommended (any more makes the card overflow on small screens).
   */
  oauthProviders?: readonly OAuthProvider[];
  /** Link rendered under the password field — "Forgot password?". */
  forgotPasswordHref?: string;
  /** Full-width link rendered under the card — "Don't have an account? Sign up". */
  signupPrompt?: {
    text: string;
    linkLabel: string;
    href: string;
  };
  /**
   * Error message rendered above the form. Pass the latest error from your
   * auth handler; block displays it in a destructive-tinted alert block.
   */
  errorMessage?: string;
  /** Extra classes merged into the outer section. */
  className?: string;
}

/**
 * Auth card block. Composes OAuth provider buttons + email/password form +
 * forgot-password link + signup prompt. Consumer owns the actual auth
 * logic via `onEmailSubmit` + each provider's `onClick`; the block handles
 * layout, accessibility, pending state, and error display.
 *
 * Centered on the viewport by default so it works both as a standalone
 * `/login` page and as the content of a modal. Wrap in a parent with a
 * different layout if you need a split-screen "product image + login" shape.
 */
export function LoginCard(props: LoginCardProps) {
  const {
    heading = "Sign in",
    description,
    onEmailSubmit,
    emailSubmitLabel = "Sign in",
    oauthProviders,
    forgotPasswordHref,
    signupPrompt,
    errorMessage,
    className,
  } = props;

  const reveal = useAnimationPreset(cardReveal);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthPending, setOauthPending] = useState<string | null>(null);

  const hasOauth = oauthProviders !== undefined && oauthProviders.length > 0;
  const hasEmailForm = onEmailSubmit !== undefined;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || onEmailSubmit === undefined) return;
    setSubmitting(true);
    try {
      await onEmailSubmit({ email, password });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOauth = async (provider: OAuthProvider) => {
    if (oauthPending !== null) return;
    setOauthPending(provider.id);
    try {
      await provider.onClick();
    } finally {
      setOauthPending(null);
    }
  };

  return (
    <section
      className={cn(
        "flex min-h-[80vh] w-full items-center justify-center bg-background p-6 text-foreground",
        className,
      )}
    >
      <motion.div
        className="w-full max-w-md"
        initial="initial"
        animate="animate"
        variants={reveal.variants}
        transition={reveal.transition}
      >
        <Card>
          <CardContent className="flex flex-col gap-6 p-6 md:p-8">
            <header className="space-y-2 text-center">
              <h1
                className="text-2xl font-semibold tracking-tight text-foreground"
                style={{ fontFamily: "var(--font-heading, inherit)" }}
              >
                {heading}
              </h1>
              {description !== undefined && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </header>

            {errorMessage !== undefined && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {errorMessage}
              </div>
            )}

            {hasOauth && (
              <div className="flex flex-col gap-2">
                {oauthProviders.map((provider) => (
                  <Button
                    key={provider.id}
                    variant="outline"
                    size="lg"
                    className="w-full justify-center gap-2"
                    onClick={() => void handleOauth(provider)}
                    disabled={
                      oauthPending !== null && oauthPending !== provider.id
                    }
                    aria-busy={oauthPending === provider.id}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {provider.icon}
                    </span>
                    <span>{provider.label}</span>
                  </Button>
                ))}
              </div>
            )}

            {hasOauth && hasEmailForm && (
              <div className="relative flex items-center gap-3">
                <span className="h-px flex-1 bg-border" aria-hidden />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  or
                </span>
                <span className="h-px flex-1 bg-border" aria-hidden />
              </div>
            )}

            {hasEmailForm && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={submitting}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="login-password">Password</Label>
                    {forgotPasswordHref !== undefined && (
                      <a
                        href={forgotPasswordHref}
                        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        Forgot password?
                      </a>
                    )}
                  </div>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={submitting}
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={submitting || email.length === 0 || password.length === 0}
                  aria-busy={submitting}
                >
                  {submitting ? "Signing in…" : emailSubmitLabel}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {signupPrompt !== undefined && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {signupPrompt.text}{" "}
            <a
              href={signupPrompt.href}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {signupPrompt.linkLabel}
            </a>
          </p>
        )}
      </motion.div>
    </section>
  );
}

export const loginCardMetadata: BlockMetadata = {
  id: "login-card",
  name: "Login Card",
  description:
    "Auth card with OAuth provider buttons, email/password form, forgot-password link, and signup prompt. Handles pending state + error display.",
  category: "auth",
  useCases: [
    "sign in page",
    "login modal",
    "authentication landing",
    "returning user entry",
  ],
  supportedPersonas: "all",
  motionPresets: ["cardReveal"],
  tags: ["auth", "login", "oauth", "form", "signin"],
  available: true,
};

LoginCard.displayName = "LoginCard";
