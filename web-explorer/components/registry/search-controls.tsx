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
      <div className="flex flex-col xs:flex-row gap-2">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search 
            className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" 
            aria-hidden="true" 
          />
          <Input
            type="search"
            placeholder="Search name, description, or ID..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 bg-card/50 border-border/50 h-9 text-xs placeholder:text-muted-foreground/70"
            aria-label="Search programs by name, description, or program ID"
            maxLength={100}
          />
        </div>
        
        {/* Sort Select */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal 
            className="size-3.5 text-muted-foreground hidden sm:block" 
            aria-hidden="true" 
          />
          <Select value={sortOption} onValueChange={(value) => onSortChange(value as SortOption)}>
            <SelectTrigger 
              className="w-full xs:w-[140px] sm:w-[160px] bg-card/50 border-border/50 h-9 text-xs"
              aria-label="Sort programs"
            >
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent" className="text-xs">Most Recent</SelectItem>
              <SelectItem value="deployments" className="text-xs">Most Deployments</SelectItem>
              <SelectItem value="name" className="text-xs">Name A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Results count announcement for screen readers */}
      <p 
        className="text-[10px] sm:text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {resultCount} {resultCount === 1 ? 'result' : 'results'}
      </p>
    </div>
  );
}
