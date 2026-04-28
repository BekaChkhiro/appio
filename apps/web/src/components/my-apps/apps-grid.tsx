"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Skeleton } from "@appio/ui";
import { useMyAppsInfinite, useDeleteApp } from "@appio/api-client";
import { AppCard } from "./app-card";
import { EmptyState } from "./empty-state";
import { Loader2, AlertTriangle } from "lucide-react";

export function AppsGrid() {
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMyAppsInfinite();
  const deleteApp = useDeleteApp();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = useCallback(
    (id: string) => {
      setDeleteError(null);
      deleteApp.mutate(id, {
        onError: (err) => {
          const message =
            err instanceof Error ? err.message : "Failed to delete app. Please try again.";
          setDeleteError(message);
        },
      });
    },
    [deleteApp],
  );

  // Auto-load next page when the sentinel at the grid bottom scrolls into view.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !isFetchingNextPage) {
            fetchNextPage();
          }
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-lg border border-border p-4"
          >
            <Skeleton className="h-1.5 w-full rounded-none -mx-4 -mt-4" />
            <div className="flex items-center gap-3 mt-1">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          Failed to load your apps.
        </p>
        <button
          onClick={() => refetch()}
          className="text-sm text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const apps = data?.pages.flatMap((p) => p.items) ?? [];

  // Empty state
  if (apps.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      {deleteError && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {deleteError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app, i) => (
          <AppCard
            key={app.id}
            app={app}
            index={i}
            onDelete={handleDelete}
            isDeleting={
              deleteApp.isPending && deleteApp.variables === app.id
            }
          />
        ))}
      </div>

      {/* Infinite-scroll sentinel + spinner */}
      {hasNextPage && (
        <div
          ref={sentinelRef}
          className="mt-6 flex justify-center py-4"
          aria-hidden={!isFetchingNextPage}
        >
          {isFetchingNextPage && (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          )}
        </div>
      )}
    </>
  );
}
