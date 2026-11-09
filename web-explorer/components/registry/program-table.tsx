"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";
import {
  type Program,
  formatRelativeTime,
  truncateAddress,
  getSolanaExplorerUrl,
} from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";

interface ProgramTableProps {
  programs: Program[];
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copy ${label}`}
      title={copied ? "Copied!" : `Copy ${label}`}
      className="inline-flex size-6 items-center justify-center rounded text-text-muted hover:text-foreground hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent transition-colors"
    >
      {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
    </button>
  );
}

export function ProgramTable({ programs }: ProgramTableProps) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      {/* Desktop Table View */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" role="table">
          <thead className="border-b border-border bg-surface-2/60 text-xs text-text-muted uppercase tracking-wider font-mono">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Program</th>
              <th scope="col" className="px-4 py-3 font-medium">Program ID</th>
              <th scope="col" className="px-4 py-3 font-medium">Authority</th>
              <th scope="col" className="px-4 py-3 font-medium text-center">Instructions</th>
              <th scope="col" className="px-4 py-3 font-medium text-center">Deployments</th>
              <th scope="col" className="px-4 py-3 font-medium">Registered</th>
              <th scope="col" className="px-4 py-3 font-medium text-right">Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {programs.map((program) => {
              const explorerUrl = getSolanaExplorerUrl(program.programId);
              return (
                <tr
                  key={program.programId}
                  className="hover:bg-surface-2/40 transition-colors focus-within:bg-surface-2/50"
                >
                  {/* Name & Details */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {program.programName}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-text-muted font-mono">
                        v{program.version}
                      </span>
                      <span className="text-text-muted text-[10px]">•</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-text-muted">
                        {program.category}
                      </Badge>
                    </div>
                  </td>

                  {/* Program ID with Copy */}
                  <td className="px-4 py-3 font-mono text-xs text-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span>{truncateAddress(program.programId, 6)}</span>
                      <CopyButton text={program.programId} label="Program ID" />
                    </div>
                  </td>

                  {/* Authority with Copy */}
                  <td className="px-4 py-3 font-mono text-xs text-text-muted whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span>{truncateAddress(program.creator, 5)}</span>
                      <CopyButton text={program.creator} label="Authority address" />
                    </div>
                  </td>

                  {/* Instructions */}
                  <td className="px-4 py-3 font-mono text-xs text-center text-foreground">
                    {program.instructionCount}
                  </td>

                  {/* Deployments */}
                  <td className="px-4 py-3 font-mono text-xs text-center text-foreground">
                    {program.deploymentCount}
                  </td>

                  {/* Registered relative time */}
                  <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                    {formatRelativeTime(program.registeredAt)}
                  </td>

                  {/* Explorer Link */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex size-7 items-center justify-center rounded text-text-muted hover:text-accent hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent transition-colors"
                      aria-label={`View ${program.programName} on Solana Explorer`}
                      title="View on Solana Explorer"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
