"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, Skeleton } from "@appio/ui";
import { useAppTemplates, useAppTemplateCategories } from "@appio/api-client";
import { TemplateCard } from "./template-card";
import { CategoryPills } from "./category-pills";
import { TemplateSearch } from "./template-search";

export function TemplatesView() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const {
    data: categories = [],
    isLoading: catLoading,
    isError: catError,
  } = useAppTemplateCategories();
  const { data: templates = [], isLoading, isError, refetch } =
    useAppTemplates(selectedCategory);

  // Client-side fuzzy search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }, [templates, search]);

  return (
    <div className="mobile-page-scroll flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link href="/build">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Templates</h1>
      </div>

      {/* Search */}
      <div className="px-4 pt-4 sm:px-6">
        <TemplateSearch value={search} onChange={setSearch} />
      </div>

      {/* Category pills */}
      {!catLoading && !catError && categories.length > 0 && (
        <CategoryPills
          categories={categories}
          selected={selectedCategory}
          onSelect={(cat) => {
            setSelectedCategory(cat);
            setSearch("");
          }}
        />
      )}

      {/* Grid */}
      <div className="flex-1 p-4 pt-3 sm:p-6 sm:pt-3">
        {isLoading ? (
          <TemplatesSkeleton />
        ) : isError ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              Failed to load templates.
            </p>
            <button
              onClick={() => refetch()}
              className="text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-muted-foreground">
              {search
                ? `No templates matching "${search}"`
                : "No templates available yet."}
            </p>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-sm text-primary hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {filtered.map((template, i) => (
              <TemplateCard key={template.id} template={template} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TemplatesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-lg border border-border p-4"
        >
          <div className="flex items-start justify-between">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-1 h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <div className="mt-1 flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
