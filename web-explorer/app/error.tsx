"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    // Log error to error tracking service in production
    console.error("[v0] App error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="text-center max-w-md">
        <div className="size-16 sm:size-20 rounded-xl sm:rounded-2xl bg-destructive/10 flex items-center justify-center mb-4 sm:mb-6 border border-destructive/20 mx-auto">
          <AlertCircle className="size-8 sm:size-10 text-destructive" />
        </div>
        
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
          Something went wrong
        </h1>
        
        <p className="text-xs sm:text-sm text-muted-foreground mb-6">
          An unexpected error occurred. Our team has been notified.
          {error.digest && (
            <span className="block mt-2 font-mono text-[10px] text-muted-foreground/60">
              Error ID: {error.digest}
            </span>
          )}
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className="w-full sm:w-auto border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <RefreshCw className="size-4 mr-2" />
            Try Again
          </Button>
          
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
          >
            <Link href="/">
              <Home className="size-4 mr-2" />
              Go Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
