import Link from "next/link";
import { Button } from "@appio/ui";
import { Home, Sparkles } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex items-center gap-2 text-primary">
        <Sparkles className="h-6 w-6" />
        <span className="text-lg font-semibold tracking-tight">Appio</span>
      </div>

      <div className="space-y-2">
        <p className="text-6xl font-bold tracking-tighter text-primary/80">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/">
            <Home className="mr-2 h-4 w-4" />
            Back to home
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/build">Build an app</Link>
        </Button>
      </div>
    </div>
  );
}
