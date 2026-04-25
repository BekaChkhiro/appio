"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import type {
  GenerateThemeRequest,
  GenerateThemeResponse,
  SavedTheme,
  ThemeListResponse,
} from "../types";

export function useGenerateTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: GenerateThemeRequest) =>
      api.post<GenerateThemeResponse>("/api/v1/themes/generate", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["themes"] });
    },
  });
}

export function useMyThemes(params?: { limit?: number; offset?: number }) {
  const limit = params?.limit ?? 20;
  const offset = params?.offset ?? 0;

  return useQuery({
    queryKey: ["themes", "list", limit, offset],
    queryFn: () =>
      api.get<ThemeListResponse>(
        `/api/v1/themes/?limit=${limit}&offset=${offset}`
      ),
    staleTime: 30_000,
  });
}

export function useTheme(id: string | null) {
  return useQuery({
    queryKey: ["themes", "detail", id],
    enabled: id !== null,
    staleTime: 30_000,
    queryFn: () => api.get<SavedTheme>(`/api/v1/themes/${id}`),
  });
}

export function useDeleteTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (themeId: string) => api.delete(`/api/v1/themes/${themeId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["themes"] });
    },
  });
}
