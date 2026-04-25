"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Card,
  CardContent,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@appio/ui";
import type { App } from "@appio/api-client";
import {
  MoreVertical,
  Pencil,
  Trash2,
  Share2,
  ExternalLink,
  Globe,
  CloudUpload,
  Settings,
} from "lucide-react";
import { ShareDialog } from "./share-dialog";

const STATUS_CONFIG: Record<
  App["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  draft: { label: "Draft", variant: "secondary" },
  building: {
    label: "Building",
    variant: "outline",
    className: "border-yellow-500/50 text-yellow-500",
  },
  ready: {
    label: "Ready",
    variant: "outline",
    className: "border-green-500/50 text-green-500",
  },
  published: { label: "Published", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

interface AppCardProps {
  app: App;
  index: number;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

export function AppCard({ app, index, onDelete, isDeleting }: AppCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const status = STATUS_CONFIG[app.status];
  const themeColor = app.theme_color ?? "#7c3aed";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
      >
        <Card className="group relative overflow-hidden transition-colors hover:border-primary/30">
          {/* Theme color accent bar */}
          <div
            className="h-1.5 w-full"
            style={{ backgroundColor: themeColor }}
          />

          <CardContent className="p-4">
            {/* Header: icon + name + menu */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                  style={{ backgroundColor: themeColor }}
                >
                  {app.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-sm">
                    {app.name}
                  </h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {app.slug}.appiousercontent.com
                  </p>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity data-[state=open]:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/build?app=${app.id}`}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  {app.url && (
                    <>
                      <DropdownMenuItem onClick={() => setShareOpen(true)}>
                        <Share2 className="mr-2 h-4 w-4" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a
                          href={app.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open
                        </a>
                      </DropdownMenuItem>
                    </>
                  )}
                  {app.status === "ready" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href={`/publish/${app.id}`}>
                          <CloudUpload className="mr-2 h-4 w-4" />
                          Publish
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/apps/${app.id}/settings`}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Meta: status + version + installs */}
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <Badge variant={status.variant} className={status.className}>
                {status.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                v{app.current_version}
              </span>
              {app.install_count > 0 && (
                <span className="text-xs text-muted-foreground">
                  {app.install_count} install{app.install_count !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Footer: last updated */}
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Updated{" "}
                {new Date(app.updated_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {app.url && (
                <a
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Globe className="h-3 w-3" />
                  Live
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Share dialog */}
      {app.url && (
        <ShareDialog app={app} open={shareOpen} onOpenChange={setShareOpen} />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{app.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              This will permanently delete this app and all its versions. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                onDelete(app.id);
                setDeleteOpen(false);
              }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
