"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SortOption = "recent" | "deployments" | "name";

interface SearchControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  resultCount: number;
}

export function SearchControls({
  searchQuery,
  onSearchChange,
  sortOption,
  onSortChange,
  resultCount,
}: SearchControlsProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search programs by name, description, address, or creator..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-surface border-border h-9 text-xs text-foreground placeholder:text-text-muted"
            aria-label="Search programs by name, description, or program ID"
            maxLength={100}
          />
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal
            className="size-4 text-text-muted hidden sm:block"
            aria-hidden="true"
          />
          <Select value={sortOption} onValueChange={(value) => onSortChange(value as SortOption)}>
            <SelectTrigger
              className="w-full sm:w-[170px] bg-surface border-border h-9 text-xs text-foreground"
              aria-label="Sort programs"
            >
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-surface border-border text-foreground">
              <SelectItem value="recent" className="text-xs">Most Recent</SelectItem>
              <SelectItem value="deployments" className="text-xs">Most Deployments</SelectItem>
              <SelectItem value="name" className="text-xs">Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results count announcement for screen readers */}
      <p
        className="text-xs text-text-muted font-mono"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {resultCount} {resultCount === 1 ? "program" : "programs"} found
      </p>
    </div>
  );
}
