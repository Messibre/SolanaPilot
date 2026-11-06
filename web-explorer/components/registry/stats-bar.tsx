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
      className="grid grid-cols-3 gap-3"
      role="region"
      aria-label="Registry statistics"
    >
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-1.5 text-text-muted text-xs uppercase tracking-wider mb-1 font-mono">
          <Layers className="size-3.5 text-accent shrink-0" aria-hidden="true" />
          <span className="truncate">Programs</span>
        </div>
        <p className="text-xl sm:text-2xl font-semibold font-mono text-foreground" aria-label={`${totalPrograms} total programs`}>
          {totalPrograms}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-1.5 text-text-muted text-xs uppercase tracking-wider mb-1 font-mono">
          <GitBranch className="size-3.5 text-text-muted shrink-0" aria-hidden="true" />
          <span className="truncate">Deployments</span>
        </div>
        <p className="text-xl sm:text-2xl font-semibold font-mono text-foreground" aria-label={`${totalDeployments} total deployments`}>
          {totalDeployments}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-1.5 text-text-muted text-xs uppercase tracking-wider mb-1 font-mono">
          <Code className="size-3.5 text-accent shrink-0" aria-hidden="true" />
          <span className="truncate">Instructions</span>
        </div>
        <p className="text-xl sm:text-2xl font-semibold font-mono text-foreground" aria-label={`${totalInstructions} total instructions`}>
          {totalInstructions}
        </p>
      </div>
    </div>
  );
}
