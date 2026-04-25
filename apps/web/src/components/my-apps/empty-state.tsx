"use client";

import Link from "next/link";
import { Button } from "@appio/ui";
import { Plus, Sparkles } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">No apps yet</h2>
        <p className="text-sm text-muted-foreground">
          Create your first app by describing it in natural language. Our AI
          will build it for you in seconds.
        </p>
        <Button asChild className="mt-2">
          <Link href="/build">
            <Plus className="mr-2 h-4 w-4" />
            Create your first app
          </Link>
        </Button>
      </div>
    </div>
  );
}
