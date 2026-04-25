"use client";

import { useId, useRef, useState } from "react";
import { ShieldAlert, ExternalLink } from "lucide-react";
import { Button, Card, CardContent, Input, Label } from "@appio/ui";
import { usePasteCredentials, ApiRequestError } from "@appio/api-client";

interface PasteDeployKeyCardProps {
  appId: string;
}

// Accepts both legacy URLs (https://name.convex.cloud) and current
// region-scoped URLs (https://name.eu-west-1.convex.cloud) returned by
// the Convex provisioning API.
const CONVEX_CLOUD_RE = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)?\.convex\.cloud\/?$/;

function validateDeploymentUrl(value: string): string | null {
  if (!value) return "Deployment URL is required.";
  if (!CONVEX_CLOUD_RE.test(value))
    return "Must be a valid https://*.convex.cloud URL.";
  return null;
}

function validateDeployKey(value: string): string | null {
  if (!value) return "Deploy key is required.";
  if (value.length < 10) return "Deploy key must be at least 10 characters.";
  return null;
}

export function PasteDeployKeyCard({ appId }: PasteDeployKeyCardProps) {
  const [deploymentUrl, setDeploymentUrl] = useState("");
  const [deployKey, setDeployKey] = useState("");
  const [touched, setTouched] = useState({ deploymentUrl: false, deployKey: false });
  const mutation = usePasteCredentials();

  // Stable IDs for a11y wiring
  const warningId = useId();
  const urlErrorId = useId();
  const keyErrorId = useId();
  const serverErrorId = useId();

  const urlRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  const urlError = touched.deploymentUrl ? validateDeploymentUrl(deploymentUrl) : null;
  const keyError = touched.deployKey ? validateDeployKey(deployKey) : null;
  const isValid = !validateDeploymentUrl(deploymentUrl) && !validateDeployKey(deployKey);

  const serverError =
    mutation.isError
      ? mutation.error instanceof ApiRequestError
        ? mutation.error.message
        : "An unexpected error occurred. Please try again."
      : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Mark all fields touched so errors surface
    setTouched({ deploymentUrl: true, deployKey: true });

    const urlErr = validateDeploymentUrl(deploymentUrl);
    const keyErr = validateDeployKey(deployKey);

    if (urlErr) {
      urlRef.current?.focus();
      return;
    }
    if (keyErr) {
      keyRef.current?.focus();
      return;
    }

    mutation.mutate(
      { appId, body: { deploy_key: deployKey, deployment_url: deploymentUrl } },
      {
        onSuccess: () => {
          // Clear sensitive key from component state immediately after success
          setDeploymentUrl("");
          setDeployKey("");
          setTouched({ deploymentUrl: false, deployKey: false });
          // Drop React Query's retained mutation variables (which still hold
          // the raw deploy key) now that the POST succeeded.
          mutation.reset();
        },
      }
    );
  }

  // Both `prod:<team>|<secret>` (newer team-scoped) and
  // `<deployment>|<secret>` (older deployment-scoped) keys are valid.
  // Only warn when the format doesn't match either pattern.
  const keyWarnPrefix =
    touched.deployKey &&
    deployKey.length > 0 &&
    !/^(?:prod:)?[a-z0-9-]+\|.+$/.test(deployKey);

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardContent className="p-8">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <ShieldAlert className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Paste your Convex deploy key</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Appio will deploy your app to your own Convex project using this key.
              </p>
            </div>
          </div>

          {/* Security warning */}
          <div
            id={warningId}
            role="note"
            className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Your deploy key grants full write access to your Convex deployment. It is
              encrypted at rest and <strong>never shown back to you</strong>.
            </span>
          </div>

          {/* Instructions */}
          <details className="group rounded-md border border-border">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              How to get your deploy key
            </summary>
            <ol className="space-y-2 px-4 pb-4 pt-2 text-sm text-muted-foreground [counter-reset:steps]">
              {[
                <>
                  Open{" "}
                  <a
                    href="https://dashboard.convex.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 font-medium text-foreground underline underline-offset-2 hover:text-primary"
                  >
                    dashboard.convex.dev
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </>,
                "Create a new project, or select an existing one.",
                <>
                  Go to <strong>Settings &rarr; Deploy Keys</strong>, click{" "}
                  <strong>Generate Production Deploy Key</strong>.
                </>,
                "Copy the deploy key. The Deployment URL is shown just above the key list — copy that too.",
                "Paste both below.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary"
                  >
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </details>

          {/* Form
              `ph-no-capture` disables PostHog autocapture on click/submit.
              `sentry-block` + `data-sentry-block` mask this subtree in Sentry
              Session Replay. Together they keep the deploy key and its form
              metadata out of any observability payload. */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className="ph-no-capture sentry-block flex flex-col gap-4"
            data-sentry-block
          >
            {/* Deployment URL */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deployment_url">Deployment URL</Label>
              <Input
                ref={urlRef}
                id="deployment_url"
                name="deployment_url"
                type="url"
                autoComplete="off"
                placeholder="https://your-project.convex.cloud"
                value={deploymentUrl}
                aria-describedby={urlError ? urlErrorId : undefined}
                aria-invalid={urlError ? "true" : undefined}
                onChange={(e) => setDeploymentUrl(e.target.value)}
                onBlur={() =>
                  setTouched((prev) => ({ ...prev, deploymentUrl: true }))
                }
              />
              {urlError && (
                <p
                  id={urlErrorId}
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {urlError}
                </p>
              )}
            </div>

            {/* Deploy key */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deploy_key">Deploy Key</Label>
              <Input
                ref={keyRef}
                id="deploy_key"
                name="deploy_key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                // Opt out of every mainstream browser/password manager save
                // prompt — deploy keys are not user credentials.
                data-1p-ignore
                data-bwignore
                data-lpignore="true"
                data-form-type="other"
                placeholder="prod:your-team:abc123..."
                value={deployKey}
                aria-describedby={
                  [warningId, keyError ? keyErrorId : "", serverError ? serverErrorId : ""]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                aria-invalid={keyError || serverError ? "true" : undefined}
                onChange={(e) => setDeployKey(e.target.value)}
                onBlur={() =>
                  setTouched((prev) => ({ ...prev, deployKey: true }))
                }
              />
              {keyWarnPrefix && !keyError && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Production deploy keys should start with <code>prod:</code>. The server will reject keys that do not.
                </p>
              )}
              {keyError && (
                <p
                  id={keyErrorId}
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {keyError}
                </p>
              )}
            </div>

            {/* Server error */}
            {serverError && (
              <p
                id={serverErrorId}
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {serverError}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!isValid || mutation.isPending}
            >
              {mutation.isPending ? "Saving..." : "Save deploy key"}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
