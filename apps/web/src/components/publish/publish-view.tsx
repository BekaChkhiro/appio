"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CloudUpload, AlertTriangle, RotateCcw } from "lucide-react";
import { Button, Card, CardContent, Skeleton } from "@appio/ui";
import {
  useCredentialsStatus,
  useRevokeCredentials,
  useApp,
  usePublishApp,
  usePublishStatus,
  IN_FLIGHT_PUBLISH_STATUSES,
} from "@appio/api-client";
import { PasteDeployKeyCard } from "./paste-deploy-key-card";
import { MigrationProgress } from "./migration-progress";
import { PublishSuccessCard } from "./publish-success-card";

interface PublishViewProps {
  appId: string;
}

export function PublishView({ appId }: PublishViewProps) {
  const credentialsQuery = useCredentialsStatus(appId);
  const appQuery = useApp(appId);
  const publishMutation = usePublishApp();
  // Always enabled — handles page reload mid-publish. Hook returns null on
  // 404 (no job ever started) so the view can fall through to the ready
  // state without treating it as an error.
  const publishStatusQuery = usePublishStatus(appId);
  const revokeCredentials = useRevokeCredentials();

  const isLoading =
    credentialsQuery.isPending || appQuery.isPending || publishStatusQuery.isPending;

  const app = appQuery.data;
  // Only fall back to publishMutation.data while its result is still fresh and
  // the server-side status query hasn't caught up yet. Without the
  // `isSuccess` guard, a stale failed response from a prior publish attempt
  // would render indefinitely after credentials are revoked + re-pasted.
  const activePublishStatus =
    publishStatusQuery.data ??
    (publishMutation.isSuccess ? publishMutation.data : null);

  function handleRepaste() {
    revokeCredentials.mutate(appId, {
      onSuccess: () => {
        // Wipe the in-memory publish result so a prior failed/published job
        // can't resurrect the old UI after new credentials are pasted.
        publishMutation.reset();
      },
    });
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href="/my-apps" aria-label="Back to My Apps">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Publish</h1>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center p-6">
        {isLoading && <PublishSkeleton />}

        {!isLoading && credentialsQuery.isError && (
          <GenericErrorState onRetry={() => credentialsQuery.refetch()} />
        )}

        {!isLoading && !credentialsQuery.isError && !credentialsQuery.data?.has_credentials && (
          <PasteDeployKeyCard appId={appId} />
        )}

        {!isLoading &&
          !credentialsQuery.isError &&
          credentialsQuery.data?.has_credentials &&
          !activePublishStatus && (
            <PublishReadyCard
              appName={app?.name ?? appId}
              deploymentUrl={credentialsQuery.data.deployment_url}
              onPublish={() => publishMutation.mutate(appId)}
              onRepaste={handleRepaste}
              isRepastePending={revokeCredentials.isPending}
              isRepasteError={revokeCredentials.isError}
              isPending={publishMutation.isPending}
              isError={publishMutation.isError}
            />
          )}

        {activePublishStatus &&
          IN_FLIGHT_PUBLISH_STATUSES.includes(activePublishStatus.status) && (
            <MigrationProgress
              status={activePublishStatus.status}
              currentStep={activePublishStatus.current_step}
              message={activePublishStatus.message}
            />
          )}

        {activePublishStatus?.status === "published" &&
          activePublishStatus.deployment_url && (
            <PublishSuccessCard
              appName={app?.name ?? appId}
              deploymentUrl={activePublishStatus.deployment_url}
            />
          )}

        {activePublishStatus?.status === "failed" && (
          <>
            <MigrationProgress
              status={activePublishStatus.status}
              currentStep={activePublishStatus.current_step}
              message={activePublishStatus.message}
            />
            <div className="mt-6">
              <Button
                type="button"
                onClick={() => publishMutation.mutate(appId)}
                disabled={publishMutation.isPending}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Retry publish
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PublishSkeleton() {
  return (
    <div className="w-full max-w-lg space-y-4" aria-busy="true" aria-label="Loading publish status">
      <Skeleton className="mx-auto h-14 w-14 rounded-full" />
      <Skeleton className="mx-auto h-6 w-48" />
      <Skeleton className="mx-auto h-4 w-72" />
      <Skeleton className="mx-auto h-4 w-64" />
      <Skeleton className="mt-4 h-10 w-full" />
    </div>
  );
}

function GenericErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <div>
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Could not load publish status. Please try again.
            </p>
          </div>
          <Button type="button" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface PublishReadyCardProps {
  appName: string;
  deploymentUrl: string | null;
  onPublish: () => void;
  onRepaste: () => void;
  isRepastePending: boolean;
  isRepasteError: boolean;
  isPending: boolean;
  isError: boolean;
}

function PublishReadyCard({
  appName,
  deploymentUrl,
  onPublish,
  onRepaste,
  isRepastePending,
  isRepasteError,
  isPending,
  isError,
}: PublishReadyCardProps) {
  // Require an explicit confirmation click before revoking working credentials
  const [confirmingRepaste, setConfirmingRepaste] = useState(false);

  // Drop the confirmation panel if a revoke request fails so the user sees the
  // error inline and isn't stuck in the confirming state.
  useEffect(() => {
    if (isRepasteError) setConfirmingRepaste(false);
  }, [isRepasteError]);

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardContent className="p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
            <CloudUpload className="h-7 w-7 text-green-500" />
          </div>

          <div>
            <h2 className="text-xl font-semibold">Ready to publish {appName}</h2>
            {deploymentUrl && (
              <p className="mt-1 text-sm text-muted-foreground">
                Publishing to{" "}
                <span className="font-medium text-foreground">{deploymentUrl}</span>
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              Your app will be migrated to your own Convex deployment. This cannot
              be undone — the sandbox version will be replaced.
            </p>
          </div>

          {isError && (
            <p
              role="alert"
              className="w-full rounded-md bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
            >
              Publish failed to start. Please try again.
            </p>
          )}

          {isRepasteError && (
            <p
              role="alert"
              className="w-full rounded-md bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
            >
              Could not clear the saved deploy key. Please try again.
            </p>
          )}

          <Button
            type="button"
            className="w-full"
            disabled={isPending}
            onClick={onPublish}
          >
            {isPending ? "Starting publish..." : "Publish to my Convex"}
          </Button>

          {/* Repaste flow — guarded by a confirmation step */}
          {!confirmingRepaste ? (
            <button
              type="button"
              className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              onClick={() => setConfirmingRepaste(true)}
            >
              Change deploy key
            </button>
          ) : (
            <div className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-muted/50 px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                This will clear your saved key. Continue?
              </span>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={isRepastePending}
                onClick={onRepaste}
              >
                {isRepastePending ? "Clearing..." : "Yes, clear key"}
              </Button>
              <button
                type="button"
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                onClick={() => setConfirmingRepaste(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
