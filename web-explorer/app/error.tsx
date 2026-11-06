"use client";

import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-bg text-text">
      <div className="text-center max-w-md rounded-lg border border-border bg-surface p-8">
        <div className="size-12 rounded-lg bg-surface-2 flex items-center justify-center mb-3 border border-border mx-auto text-danger">
          <AlertCircle className="size-6" />
        </div>

        <h1 className="text-lg font-semibold text-foreground mb-1">
          Application Error
        </h1>

        <p className="text-xs text-text-muted mb-6">
          An unexpected application error occurred while rendering the page.
          {error.digest && (
            <span className="block mt-1 font-mono text-[10px]">
              Digest: {error.digest}
            </span>
          )}
        </p>

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className="border-border text-foreground hover:bg-surface-2 text-xs"
          >
            <RefreshCw className="size-3.5 mr-1.5" />
            Try again
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-border text-foreground hover:bg-surface-2 text-xs"
          >
            <Link href="/">
              <Home className="size-3.5 mr-1.5" />
              Return home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
