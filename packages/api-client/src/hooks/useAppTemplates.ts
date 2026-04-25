"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import type { AppTemplate, AppTemplateDetail } from "../types";

export function useAppTemplates(category?: string | null) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  const qs = params.toString();
  const path = qs
    ? `/api/v1/templates/marketplace/?${qs}`
    : "/api/v1/templates/marketplace/";

  return useQuery({
    queryKey: ["app-templates", category ?? "all"],
    queryFn: () => api.get<AppTemplate[]>(path),
    staleTime: 5 * 60_000,
  });
}

export function useAppTemplateCategories() {
  return useQuery({
    queryKey: ["app-template-categories"],
    queryFn: () =>
      api.get<string[]>("/api/v1/templates/marketplace/categories"),
    staleTime: 10 * 60_000,
  });
}

export function useAppTemplateDetail(slug: string | null) {
  return useQuery({
    queryKey: ["app-template", slug],
    queryFn: () =>
      api.get<AppTemplateDetail>(`/api/v1/templates/marketplace/${slug}`),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}
