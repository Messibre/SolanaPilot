"use client";

import { Layers, GitBranch, Code } from "lucide-react";

interface StatsBarProps {
  totalPrograms: number;
  totalDeployments: number;
  totalInstructions: number;
}

export function StatsBar({ totalPrograms, totalDeployments, totalInstructions }: StatsBarProps) {
  return (
    <div 
      className="grid grid-cols-3 gap-2 sm:gap-3"
      role="region"
      aria-label="Registry statistics"
    >
      <div className="rounded-lg sm:rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-3 sm:p-4">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider mb-1 sm:mb-2">
          <Layers className="size-3 sm:size-4 text-primary shrink-0" aria-hidden="true" />
          <span className="truncate">Programs</span>
        </div>
        <p className="text-xl sm:text-2xl md:text-3xl font-bold text-primary" aria-label={`${totalPrograms} total programs`}>
          {totalPrograms}
        </p>
      </div>
      
      <div className="rounded-lg sm:rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-3 sm:p-4">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider mb-1 sm:mb-2">
          <GitBranch className="size-3 sm:size-4 text-secondary shrink-0" aria-hidden="true" />
          <span className="truncate">Deploys</span>
        </div>
        <p className="text-xl sm:text-2xl md:text-3xl font-bold text-secondary" aria-label={`${totalDeployments} total deployments`}>
          {totalDeployments}
        </p>
      </div>
      
      <div className="rounded-lg sm:rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-3 sm:p-4">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider mb-1 sm:mb-2">
          <Code className="size-3 sm:size-4 text-primary shrink-0" aria-hidden="true" />
          <span className="truncate">Instructions</span>
        </div>
        <p className="text-xl sm:text-2xl md:text-3xl font-bold text-primary" aria-label={`${totalInstructions} instructions sum`}>
          {totalInstructions}
        </p>
      </div>
    </div>
  );
}
