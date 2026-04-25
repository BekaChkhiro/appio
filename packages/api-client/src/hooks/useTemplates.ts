"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import type { Template } from "../types";

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: () => api.get<Template[]>("/api/v1/templates/"),
    staleTime: 5 * 60_000, // Templates rarely change
  });
}
