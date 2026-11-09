"use client";

import { Package, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onClearSearch?: () => void;
}

export function EmptyNoPrograms() {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-lg border border-border bg-surface"
      role="status"
      aria-label="No programs available"
    >
      <div
        className="size-12 rounded-lg bg-surface-2 flex items-center justify-center mb-3 border border-border"
        aria-hidden="true"
      >
        <Package className="size-6 text-text-muted" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">
        No registered programs found
      </h3>
      <p className="text-text-muted text-xs max-w-sm mb-4">
        Programs registered from the SolanaPilot VS Code extension on Solana devnet will appear here.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="border-border text-foreground hover:bg-surface-2 text-xs"
        asChild
      >
        <a
          href="https://github.com/Messibre/SolanaPilot"
          target="_blank"
          rel="noopener noreferrer"
        >
          View Documentation
        </a>
      </Button>
    </div>
  );
}

export function EmptyNoResults({ onClearSearch }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-lg border border-border bg-surface"
      role="status"
      aria-label="No search results"
    >
      <div
        className="size-12 rounded-lg bg-surface-2 flex items-center justify-center mb-3 border border-border"
        aria-hidden="true"
      >
        <SearchX className="size-6 text-text-muted" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">
        No matching programs
      </h3>
      <p className="text-text-muted text-xs max-w-sm mb-4">
        No registry entries matched your search query or active filter.
      </p>
      {onClearSearch && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClearSearch}
          className="border-border text-foreground hover:bg-surface-2 text-xs"
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
