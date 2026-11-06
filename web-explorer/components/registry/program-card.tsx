"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  type Program,
  formatRelativeTime,
  truncateAddress,
  getSolanaExplorerUrl,
} from "@/lib/mock-data";

interface ProgramCardProps {
  program: Program;
}

export function ProgramCard({ program }: ProgramCardProps) {
  const [copied, setCopied] = useState(false);
  const explorerUrl = getSolanaExplorerUrl(program.programId);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(program.programId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <article
      className="rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-2/40 focus-within:ring-2 focus-within:ring-accent"
      tabIndex={0}
      role="article"
      aria-labelledby={`program-${program.programId}-title`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3
            id={`program-${program.programId}-title`}
            className="font-medium text-sm text-foreground truncate"
          >
            {program.programName}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs font-mono text-text-muted">
              {truncateAddress(program.programId, 4)}
            </span>
            <button
              type="button"
              onClick={onCopy}
              aria-label="Copy Program ID"
              className="size-5 inline-flex items-center justify-center rounded text-text-muted hover:text-foreground"
            >
              {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[10px] border-border text-text-muted font-mono">
            v{program.version}
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-text-muted">
            {program.category}
          </Badge>
        </div>
      </div>

      <p className="text-xs text-text-muted line-clamp-2 mb-3">
        {program.description}
      </p>

      <div className="flex items-center justify-between text-[11px] text-text-muted font-mono pt-2 border-t border-border">
        <span>{program.instructionCount} instructions</span>
        <span>{formatRelativeTime(program.registeredAt)}</span>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted hover:text-accent inline-flex items-center gap-1"
        >
          <span>Explorer</span>
          <ExternalLink className="size-3" />
        </a>
      </div>
    </article>
  );
}
