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
      className="rounded-lg sm:rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:p-6 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center justify-center gap-2 sm:gap-3 text-destructive mb-3 sm:mb-4">
        <AlertCircle className="size-5 sm:size-6" aria-hidden="true" />
        <span className="font-semibold text-sm sm:text-lg">Something went wrong</span>
      </div>
      <p className="text-muted-foreground text-xs sm:text-sm mb-4 sm:mb-6 max-w-md mx-auto">
        {message}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground text-xs sm:text-sm"
      >
        <RefreshCw className="size-3.5 sm:size-4 mr-1.5 sm:mr-2" aria-hidden="true" />
        Try Again
      </Button>
    </div>
  );
}
