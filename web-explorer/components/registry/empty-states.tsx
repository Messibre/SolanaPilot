"use client";

import { Package, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onClearSearch?: () => void;
}

export function EmptyNoPrograms() {
  return (
    <div 
      className="flex flex-col items-center justify-center py-10 sm:py-16 px-4 text-center"
      role="status"
      aria-label="No programs available"
    >
      <div 
        className="size-16 sm:size-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/10 flex items-center justify-center mb-4 sm:mb-6 border border-primary/20"
        aria-hidden="true"
      >
        <Package className="size-8 sm:size-10 text-primary/60" />
      </div>
      <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
        No programs yet
      </h3>
      <p className="text-muted-foreground text-xs sm:text-sm max-w-sm mb-4 sm:mb-6">
        Programs registered from the SolanaPilot VS Code extension will appear here. 
        Deploy your first program to get started.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground text-xs sm:text-sm"
        asChild
      >
        <a 
          href="https://marketplace.visualstudio.com/items?itemName=SolanaPilot.solanapilot" 
          target="_blank" 
          rel="noopener noreferrer"
        >
          Get SolanaPilot Extension
        </a>
      </Button>
    </div>
  );
}

export function EmptyNoResults({ onClearSearch }: EmptyStateProps) {
  return (
    <div 
      className="flex flex-col items-center justify-center py-10 sm:py-16 px-4 text-center"
      role="status"
      aria-label="No search results"
    >
      <div 
        className="size-16 sm:size-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-muted/50 to-muted/20 flex items-center justify-center mb-4 sm:mb-6 border border-border/50"
        aria-hidden="true"
      >
        <SearchX className="size-8 sm:size-10 text-muted-foreground/60" />
      </div>
      <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
        No matches found
      </h3>
      <p className="text-muted-foreground text-xs sm:text-sm max-w-sm mb-4 sm:mb-6">
        Try adjusting your search terms or filters to find what you&apos;re looking for.
      </p>
      {onClearSearch && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClearSearch}
          className="border-border/50 hover:border-primary/30 text-xs sm:text-sm"
        >
          Clear search
        </Button>
      )}
    </div>
  );
}
