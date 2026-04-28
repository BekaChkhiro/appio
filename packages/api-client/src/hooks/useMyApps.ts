"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { api } from "../client";
import type { App, PaginatedResponse } from "../types";

export function useMyApps(page = 1, perPage = 20) {
  return useQuery({
    queryKey: ["my-apps", page, perPage],
    queryFn: async (): Promise<PaginatedResponse<App>> => {
      return api.get<PaginatedResponse<App>>(
        `/api/v1/apps/?page=${page}&per_page=${perPage}`
      );
    },
    staleTime: 30_000,
  });
}

export function useDeleteApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (appId: string) => api.delete(`/api/v1/apps/${appId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-apps"] });
      queryClient.invalidateQueries({ queryKey: ["my-apps-infinite"] });
    },
  });
}

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface MessagesResponse {
  app_id: string;
  messages: ChatMessageItem[];
}

export function useUpdateAppMessages(appId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messages: ChatMessageItem[]) => {
      if (!appId) return;
      return api.put<MessagesResponse>(`/api/v1/apps/${appId}/messages`, {
        messages,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-apps", "detail", appId] });
    },
  });
}

/**
 * Fetch a single app by ID with its chat history.
 * Used by /build?app=<uuid> to load context (preview iframe, name,
 * existing URL, and full chat history) when the user clicks Edit.
 */
export function useApp(appId: string | null | undefined) {
  return useQuery({
    queryKey: ["my-apps", "detail", appId],
    enabled: !!appId,
    staleTime: 30_000,
    queryFn: async () => {
      const app = await api.get<App>(`/api/v1/apps/${appId}`);
      let messages: ChatMessageItem[] = [];
      try {
        const msgRes = await api.get<MessagesResponse>(`/api/v1/apps/${appId}/messages`);
        messages = msgRes.messages;
      } catch {
        // Messages endpoint may not exist yet — fine to start with empty history
      }
      return { ...app, messages };
    },
    // Poll every 3 s while the backend is still generating, so users who
    // navigate away mid-stream see status changes when they return.
    // Stops polling once status leaves "building".
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "building" ? 3_000 : false;
    },
  });
}

/**
 * Infinite variant of useMyApps — backs the dashboard grid's auto-scroll.
 * Uses server-provided `has_more` to drive `getNextPageParam`.
 */
export function useMyAppsInfinite(perPage = 20) {
  return useInfiniteQuery({
    queryKey: ["my-apps-infinite", perPage],
    initialPageParam: 1,
    staleTime: 30_000,
    queryFn: async ({ pageParam }): Promise<PaginatedResponse<App>> => {
      return api.get<PaginatedResponse<App>>(
        `/api/v1/apps/?page=${pageParam}&per_page=${perPage}`
      );
    },
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
  });
}
