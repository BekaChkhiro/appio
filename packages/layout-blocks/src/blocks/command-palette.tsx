import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from "@appio/ui";
import { cn } from "../lib/utils";
import type { BlockMetadata } from "../types";

export interface CommandItem {
  /** Stable ID — used as React key + for keyboard nav tracking. */
  id: string;
  /** Visible command label. */
  label: string;
  /**
   * Optional leading icon (16-20px). Typically `lucide-react`. Helps the
   * eye scan a long list.
   */
  icon?: ReactNode;
  /**
   * Optional trailing hint — "⌘K", "shortcut", "Ctrl+S". Rendered in muted
   * mono on the right.
   */
  shortcut?: string;
  /** Optional supporting copy rendered under the label. */
  description?: string;
  /**
   * Extra keywords the search matches on beyond `label`. Useful when the
   * user might search "logout" for a command labeled "Sign out".
   */
  keywords?: readonly string[];
  /** Called when the command is executed. Close is handled separately. */
  onSelect: () => void;
}

export interface CommandGroup {
  /** Stable ID. */
  id: string;
  /** Group heading — "Actions", "Navigation", "Settings". */
  heading: string;
  /** Commands in this group. */
  items: readonly CommandItem[];
}

export interface CommandPaletteProps {
  /** Open state — controlled by the consumer. */
  open: boolean;
  /** Called when open state should change (Escape, backdrop click). */
  onOpenChange: (open: boolean) => void;
  /** Command groups. Empty groups are hidden. */
  groups: readonly CommandGroup[];
  /**
   * Placeholder for the search input. Defaults to "Search commands…". Keep
   * under 40 chars.
   */
  placeholder?: string;
  /**
   * Rendered when the user's query matches nothing. Plain string is
   * typical — "No commands found." — but JSX works too.
   */
  emptyState?: ReactNode;
  /**
   * When `true`, executing a command also closes the palette. Default `true`
   * — matches the cmdk / Raycast convention. Set `false` when commands
   * open submenus that need the palette to stay mounted.
   */
  closeOnSelect?: boolean;
}

/**
 * Searchable command launcher (⌘K-style). Filters command labels +
 * keywords against the user's query, groups results under their heading,
 * and supports full keyboard navigation: arrows to move the highlight,
 * Enter to execute, Escape to close.
 *
 * Uses `@appio/ui` `Dialog` so the modal gets Radix's focus trap,
 * inert-background, and accessibility baseline for free. Input stays
 * focused throughout; highlight tracking uses a virtual-focus pattern
 * (the input owns real focus, the row shows a visual selected state).
 *
 * Consumer owns open state so the palette can be triggered from keyboard
 * shortcuts elsewhere in the app — typically a document-level `keydown`
 * listener for `⌘K` / `Ctrl+K`.
 */
export function CommandPalette(props: CommandPaletteProps) {
  const {
    open,
    onOpenChange,
    groups,
    placeholder = "Search commands…",
    emptyState,
    closeOnSelect = true,
  } = props;

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Flattened filtered list drives keyboard nav; groups are a rendering
  // concern only. `matches` carries the group boundary for the render pass.
  const { filteredGroups, flatItems } = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const fg: Array<{
      group: CommandGroup;
      items: CommandItem[];
    }> = [];
    const flat: CommandItem[] = [];

    for (const group of groups) {
      const matchingItems = group.items.filter((item) => {
        if (normalized.length === 0) return true;
        if (item.label.toLowerCase().includes(normalized)) return true;
        if (item.description?.toLowerCase().includes(normalized) === true) {
          return true;
        }
        if (item.keywords !== undefined) {
          for (const kw of item.keywords) {
            if (kw.toLowerCase().includes(normalized)) return true;
          }
        }
        return false;
      });
      if (matchingItems.length > 0) {
        fg.push({ group, items: matchingItems });
        flat.push(...matchingItems);
      }
    }

    return { filteredGroups: fg, flatItems: flat };
  }, [groups, query]);

  // Reset highlight to top whenever the filter changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  // Clear query when closed so reopening is a fresh slate.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const execute = (item: CommandItem) => {
    item.onSelect();
    if (closeOnSelect) onOpenChange(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (flatItems.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % flatItems.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(flatItems.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = flatItems[activeIndex];
      if (item !== undefined) execute(item);
    }
  };

  // Scroll the highlighted row into view when it changes.
  useEffect(() => {
    const list = listRef.current;
    if (list === null) return;
    const row = list.querySelector<HTMLElement>(
      `[data-cmd-index="${activeIndex}"]`,
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[15%] w-full max-w-xl translate-y-0 gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search and run commands
        </DialogDescription>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            autoFocus
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            className="h-auto border-0 bg-transparent p-0 text-base shadow-none outline-none focus-visible:ring-0"
            aria-activedescendant={
              flatItems[activeIndex] !== undefined
                ? `cmd-row-${flatItems[activeIndex].id}`
                : undefined
            }
          />
        </div>

        <div
          ref={listRef}
          role="listbox"
          className="max-h-[60vh] overflow-y-auto p-2"
        >
          {flatItems.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {emptyState ?? "No commands found."}
            </div>
          ) : (
            filteredGroups.map(({ group, items }) => (
              <div key={group.id} className="mb-2 last:mb-0">
                <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.heading}
                </div>
                <ul className="flex list-none flex-col gap-0.5 p-0">
                  {items.map((item) => {
                    const flatIndex = flatItems.indexOf(item);
                    const isActive = flatIndex === activeIndex;
                    return (
                      <li key={item.id}>
                        <button
                          id={`cmd-row-${item.id}`}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          data-cmd-index={flatIndex}
                          onClick={() => execute(item)}
                          onMouseMove={() => setActiveIndex(flatIndex)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm outline-none transition-colors",
                            isActive
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground hover:bg-accent/50",
                          )}
                        >
                          {item.icon !== undefined && (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
                              {item.icon}
                            </span>
                          )}
                          <span className="flex-1 truncate">
                            <span className="block font-medium">
                              {item.label}
                            </span>
                            {item.description !== undefined && (
                              <span className="block text-xs text-muted-foreground">
                                {item.description}
                              </span>
                            )}
                          </span>
                          {item.shortcut !== undefined && (
                            <kbd
                              className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                              style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
                            >
                              {item.shortcut}
                            </kbd>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const commandPaletteMetadata: BlockMetadata = {
  id: "command-palette",
  name: "Command Palette",
  description:
    "Searchable command launcher with grouped results, keyboard navigation (arrows/enter/escape), and keyword matching. Controlled open state.",
  category: "navigation",
  useCases: [
    "app-wide command launcher",
    "⌘K / Ctrl+K quick actions",
    "searchable menu",
    "keyboard-first navigation",
  ],
  supportedPersonas: "all",
  motionPresets: [],
  tags: ["command-palette", "search", "keyboard", "cmdk", "navigation"],
  available: true,
};

CommandPalette.displayName = "CommandPalette";
