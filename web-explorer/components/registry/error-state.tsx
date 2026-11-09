"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      className="rounded-lg border border-danger/40 bg-surface p-6 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center justify-center gap-2 text-danger mb-2">
        <AlertCircle className="size-5" aria-hidden="true" />
        <span className="font-semibold text-sm">Failed to load registry data</span>
      </div>
      <p className="text-text-muted text-xs mb-4 max-w-md mx-auto">
        {message}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="border-border text-foreground hover:bg-surface-2 text-xs"
      >
        <RefreshCw className="size-3.5 mr-1.5" aria-hidden="true" />
        Retry connection
      </Button>
    </div>
  );
}
