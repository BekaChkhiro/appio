"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, Copy, Check, ExternalLink } from "lucide-react";
import { Button, Card, CardContent } from "@appio/ui";

interface PublishSuccessCardProps {
  appName: string;
  deploymentUrl: string;
}

export function PublishSuccessCard({
  appName,
  deploymentUrl,
}: PublishSuccessCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(deploymentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle className="h-14 w-14 text-green-500" />

          <div>
            <h2 className="text-xl font-semibold">
              {appName} is now live on your Convex
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your app has been migrated to your own Convex deployment.
            </p>
          </div>

          <div className="flex w-full items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
            <span className="flex-1 truncate text-left text-sm">
              {deploymentUrl}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy deployment URL"
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            <a
              href={deploymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open deployment in new tab"
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="flex w-full flex-col gap-2">
            <Button asChild className="w-full">
              <Link href="/my-apps">Back to My Apps</Link>
            </Button>

            <a
              href="https://dashboard.convex.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              Open Convex Dashboard
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
