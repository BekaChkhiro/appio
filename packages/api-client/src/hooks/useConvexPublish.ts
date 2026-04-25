"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiRequestError, api } from "../client";
import type {
  CredentialsStatusResponse,
  PasteCredentialsRequest,
  PublishStatusResponse,
  PublishStatus,
} from "../types";

export const IN_FLIGHT_PUBLISH_STATUSES: readonly PublishStatus[] = [
  "pending",
  "provisioning",
  "pushing_schema",
  "pushing_functions",
  "copying_data",
  "rewriting_config",
  "rebuilding",
];

export function useCredentialsStatus(appId: string) {
  return useQuery({
    queryKey: ["convex", "credentials", appId],
    queryFn: () =>
      api.get<CredentialsStatusResponse>(`/api/v1/convex/credentials/${appId}`),
    staleTime: 10_000,
  });
}

export function usePasteCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      appId,
      body,
    }: {
      appId: string;
      body: PasteCredentialsRequest;
    }) => api.post<void>(`/api/v1/convex/credentials/${appId}`, body),
    onSuccess: (_data, { appId }) => {
      queryClient.invalidateQueries({
        queryKey: ["convex", "credentials", appId],
      });
      // Clear any stale failed/published job so the ready-to-publish card
      // renders after new credentials are saved.
      queryClient.invalidateQueries({ queryKey: ["convex", "publish", appId] });
    },
  });
}

export function useRevokeCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (appId: string) =>
      api.delete<void>(`/api/v1/convex/credentials/${appId}`),
    onSuccess: (_data, appId) => {
      queryClient.invalidateQueries({
        queryKey: ["convex", "credentials", appId],
      });
      queryClient.invalidateQueries({ queryKey: ["convex", "publish", appId] });
    },
  });
}

export function usePublishApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (appId: string) =>
      api.post<PublishStatusResponse>(`/api/v1/convex/publish/${appId}`, {}),
    onSuccess: (_data, appId) => {
      queryClient.invalidateQueries({ queryKey: ["convex", "publish", appId] });
      queryClient.invalidateQueries({ queryKey: ["my-apps"] });
      queryClient.invalidateQueries({ queryKey: ["my-apps-infinite"] });
    },
  });
}

export function usePublishStatus(appId: string | null) {
  const queryClient = useQueryClient();

  return useQuery<PublishStatusResponse | null>({
    queryKey: ["convex", "publish", appId],
    enabled: appId !== null,
    queryFn: async () => {
      try {
        return await api.get<PublishStatusResponse>(
          `/api/v1/convex/publish/${appId}/status`
        );
      } catch (err) {
        // 404 = no publish job has ever been started for this app. Treat as
        // "no active publish" (null) rather than an error so the view can
        // fall through to the ready-to-publish state.
        if (err instanceof ApiRequestError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return false;
      if (status === "published" || status === "failed") {
        // Invalidate my-apps + app detail once so UI picks up the new status.
        queryClient.invalidateQueries({ queryKey: ["my-apps"] });
        queryClient.invalidateQueries({ queryKey: ["my-apps-infinite"] });
        return false;
      }
      return IN_FLIGHT_PUBLISH_STATUSES.includes(status) ? 2000 : false;
    },
  });
}
