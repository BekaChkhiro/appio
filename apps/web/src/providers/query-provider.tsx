"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  // Don't retry auth errors — the API client already handles one token
  // refresh internally. Retrying here just creates extra 401 requests.
  if (
    error instanceof Error &&
    (error.name === "AuthError" ||
      (error as { status?: number }).status === 401)
  ) {
    return false;
  }
  // Retry everything else once (failureCount starts at 0)
  return failureCount < 1;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: shouldRetryQuery,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
