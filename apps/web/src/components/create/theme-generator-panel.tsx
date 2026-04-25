"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import {
  Button,
  Input,
  Label,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  cn,
  useAnimationPreset,
  cardReveal,
} from "@appio/ui";
import {
  useGenerateTheme,
  useMyThemes,
  useDeleteTheme,
} from "@appio/api-client";
import type { SavedTheme, GenerateThemeResponse } from "@appio/api-client";
import { PersonaPreviewCard } from "@/components/personas/persona-preview-card";

interface ThemeGeneratorPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTheme?: (theme: SavedTheme) => void;
}

export function ThemeGeneratorPanel({
  open,
  onOpenChange,
  onSelectTheme,
}: ThemeGeneratorPanelProps) {
  const [themeName, setThemeName] = useState("");
  const [textPrompt, setTextPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [activeTab, setActiveTab] = useState<"text" | "image">("text");
  const [result, setResult] = useState<GenerateThemeResponse | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const generateMutation = useGenerateTheme();
  const { data: themesData, isLoading: themesLoading } = useMyThemes({ limit: 20 });
  const deleteMutation = useDeleteTheme();

  const resultPreset = useAnimationPreset(cardReveal);

  function handleGenerate() {
    const body =
      activeTab === "text"
        ? { prompt: textPrompt, name: themeName || undefined }
        : { image_url: imageUrl, name: themeName || undefined };

    generateMutation.mutate(body, {
      onSuccess: (data) => setResult(data),
    });
  }

  function handleSaveAndClose() {
    onOpenChange(false);
  }

  function handleDeleteTheme(themeId: string, e: React.MouseEvent) {
    e.stopPropagation();
    deleteMutation.mutate(themeId);
  }

  const canGenerate =
    activeTab === "text" ? textPrompt.trim().length > 0 : imageUrl.trim().length > 0;

  const wcag = result?.wcag;
  const wcagBadgeClass = !wcag
    ? ""
    : wcag.errors.length > 0
      ? "bg-destructive/10 text-destructive"
      : wcag.warnings.length > 0
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "bg-green-500/10 text-green-600 dark:text-green-400";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[420px]"
      >
        <SheetHeader className="shrink-0 border-b border-border px-5 py-4">
          <SheetTitle>AI Theme Generator</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-5 p-5">
            {/* Optional theme name */}
            <div className="space-y-1.5">
              <Label htmlFor="theme-name">Theme name (optional)</Label>
              <Input
                id="theme-name"
                placeholder="e.g. Ocean Breeze"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
              />
            </div>

            {/* Source input tabs */}
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "text" | "image")}
            >
              <TabsList className="w-full">
                <TabsTrigger value="text" className="flex-1">
                  Text prompt
                </TabsTrigger>
                <TabsTrigger value="image" className="flex-1">
                  Image URL
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="text-prompt">Describe the theme</Label>
                  <Textarea
                    id="text-prompt"
                    placeholder="A calming meditation app with soft blues and warm whites…"
                    value={textPrompt}
                    onChange={(e) => setTextPrompt(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleGenerate}
                  disabled={!canGenerate || generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    "Generate"
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="image" className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="image-url">Image URL</Label>
                  <Input
                    id="image-url"
                    type="url"
                    placeholder="https://example.com/palette.png"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleGenerate}
                  disabled={!canGenerate || generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    "Generate"
                  )}
                </Button>
              </TabsContent>
            </Tabs>

            {/* Error state */}
            {generateMutation.error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
              >
                <X className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{(generateMutation.error as Error).message}</span>
              </div>
            )}

            {/* Result section */}
            <AnimatePresence>
              {result && (
                <motion.div
                  key="result"
                  variants={resultPreset.variants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={resultPreset.transition}
                  className="space-y-4"
                >
                  {/* WCAG badge */}
                  {wcag && (
                    <div className="space-y-2">
                      <div
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
                          wcagBadgeClass
                        )}
                      >
                        {wcag.errors.length > 0 ? (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {wcag.errors.length} WCAG{" "}
                            {wcag.errors.length === 1 ? "error" : "errors"}
                          </>
                        ) : wcag.warnings.length > 0 ? (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {wcag.warnings.length}{" "}
                            {wcag.warnings.length === 1 ? "warning" : "warnings"}
                          </>
                        ) : (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            WCAG AA passes
                          </>
                        )}
                      </div>

                      {(wcag.errors.length > 0 || wcag.warnings.length > 0) && (
                        <ul className="space-y-0.5 text-xs text-muted-foreground">
                          {wcag.errors.map((msg, i) => (
                            <li key={`err-${i}`} className="text-destructive">
                              {msg}
                            </li>
                          ))}
                          {wcag.warnings.map((msg, i) => (
                            <li key={`warn-${i}`}>{msg}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Persona preview — both schemes */}
                  <div className="grid grid-cols-1 gap-3">
                    <PersonaPreviewCard persona={result.persona} scheme="light" />
                    <PersonaPreviewCard persona={result.persona} scheme="dark" />
                  </div>

                  {/* Cost line */}
                  <p className="text-xs text-muted-foreground">
                    Cost:{" "}
                    <span className="font-mono">
                      ${result.cost_usd.toFixed(4)}
                    </span>{" "}
                    per request
                  </p>

                  {/* Save to library */}
                  <Button className="w-full" onClick={handleSaveAndClose}>
                    Save to library
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Library section */}
            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setLibraryOpen((v) => !v)}
                className="flex w-full items-center justify-between text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-expanded={libraryOpen}
              >
                My themes
                {libraryOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              <AnimatePresence initial={false}>
                {libraryOpen && (
                  <motion.div
                    key="library"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-1">
                      {themesLoading && (
                        <p className="py-4 text-center text-xs text-muted-foreground">
                          Loading…
                        </p>
                      )}
                      {!themesLoading && themesData?.items.length === 0 && (
                        <p className="py-4 text-center text-xs text-muted-foreground">
                          No saved themes yet.
                        </p>
                      )}
                      {themesData?.items.map((theme) => (
                        <ThemeRow
                          key={theme.id}
                          theme={theme}
                          onSelect={() => {
                            console.log("[ThemeGeneratorPanel] selected theme", theme.id);
                            onSelectTheme?.(theme);
                          }}
                          onDelete={(e) => handleDeleteTheme(theme.id, e)}
                          isDeleting={deleteMutation.isPending}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

interface ThemeRowProps {
  theme: SavedTheme;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  isDeleting: boolean;
}

function ThemeRow({ theme, onSelect, onDelete, isDeleting }: ThemeRowProps) {
  // Show the first 5 primary-family colors from the light palette
  const swatchSlots = [
    "primary",
    "secondary",
    "accent",
    "muted",
    "background",
  ] as const;

  const createdDate = new Date(theme.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {/* Color swatches */}
      <div className="flex shrink-0 gap-0.5" aria-hidden="true">
        {swatchSlots.map((slot) => (
          <div
            key={slot}
            className="h-5 w-5 rounded-sm border border-border/50 first:rounded-l-md last:rounded-r-md"
            style={{ background: theme.persona.light.rgb[slot] }}
            title={slot}
          />
        ))}
      </div>

      {/* Name + date */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {theme.name}
        </p>
        <p className="text-xs text-muted-foreground">{createdDate}</p>
      </div>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={onDelete}
        disabled={isDeleting}
        aria-label={`Delete theme ${theme.name}`}
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </button>
  );
}
