"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { api } from "../client";
import type { App, PaginatedResponse } from "../types";

// TODO: Remove mock data when backend is available
const MOCK_APPS: App[] = [
  {
    id: "1",
    name: "Expense Tracker",
    slug: "expense-tracker",
    description: "Track your daily expenses, set budgets, and visualize spending with charts.",
    url: "https://expense-tracker.appiousercontent.com",
    status: "ready",
    theme_color: "#10b981",
    current_version: 3,
    install_count: 12,
    created_at: "2026-04-10T10:00:00Z",
    updated_at: "2026-04-14T15:30:00Z",
  },
  {
    id: "2",
    name: "Habit Tracker",
    slug: "habit-tracker",
    description: "Build better habits with daily tracking, streaks, and weekly progress charts.",
    url: "https://habit-tracker.appiousercontent.com",
    status: "published",
    theme_color: "#7c3aed",
    current_version: 5,
    install_count: 47,
    created_at: "2026-04-08T12:00:00Z",
    updated_at: "2026-04-15T09:00:00Z",
  },
  {
    id: "3",
    name: "Meditation Timer",
    slug: "meditation-timer",
    description: null,
    url: null,
    status: "building",
    theme_color: "#3b82f6",
    current_version: 1,
    install_count: 0,
    created_at: "2026-04-15T11:00:00Z",
    updated_at: "2026-04-15T11:00:00Z",
  },
  {
    id: "4",
    name: "Budget Planner",
    slug: "budget-planner",
    description: "Plan your monthly budget and track spending across categories.",
    url: "https://budget-planner.appiousercontent.com",
    status: "ready",
    theme_color: "#f59e0b",
    current_version: 2,
    install_count: 3,
    created_at: "2026-04-12T08:00:00Z",
    updated_at: "2026-04-13T17:45:00Z",
  },
  {
    id: "5",
    name: "Quiz App",
    slug: "quiz-app",
    description: null,
    url: null,
    status: "failed",
    theme_color: "#ef4444",
    current_version: 1,
    install_count: 0,
    created_at: "2026-04-14T16:00:00Z",
    updated_at: "2026-04-14T16:05:00Z",
  },
  {
    id: "6",
    name: "Notes App",
    slug: "notes-app",
    description: null,
    url: null,
    status: "draft",
    theme_color: "#6366f1",
    current_version: 1,
    install_count: 0,
    created_at: "2026-04-15T12:00:00Z",
    updated_at: "2026-04-15T12:00:00Z",
  },
];

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export function useMyApps(page = 1, perPage = 20) {
  return useQuery({
    queryKey: ["my-apps", page, perPage],
    queryFn: async (): Promise<PaginatedResponse<App>> => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 600));
        return {
          items: MOCK_APPS,
          total: MOCK_APPS.length,
          page: 1,
          per_page: perPage,
          has_more: false,
        };
      }
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
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 400));
        return {
          items: MOCK_APPS,
          total: MOCK_APPS.length,
          page: pageParam as number,
          per_page: perPage,
          has_more: false,
        };
      }
      return api.get<PaginatedResponse<App>>(
        `/api/v1/apps/?page=${pageParam}&per_page=${perPage}`
      );
    },
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
  });
}
