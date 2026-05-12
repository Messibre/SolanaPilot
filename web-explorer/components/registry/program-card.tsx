"use client";

import { ExternalLink, Eye, Code, GitBranch, Calendar, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  type Program, 
  formatRelativeTime, 
  truncateAddress, 
  getSolanaExplorerUrl,
  categoryColors 
} from "@/lib/mock-data";

interface ProgramCardProps {
  program: Program;
}

export function ProgramCard({ program }: ProgramCardProps) {
  const categoryStyle = categoryColors[program.category] || { bg: 'bg-muted/50', text: 'text-muted-foreground' };
  
  return (
    <article
      className="group rounded-lg sm:rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-3 sm:p-4 transition-all duration-200 hover:border-primary/50 hover:bg-card/80 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
      tabIndex={0}
      role="article"
      aria-labelledby={`program-${program.programId}-title`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div 
            className="size-8 sm:size-10 rounded-md sm:rounded-lg bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center border border-primary/20 shrink-0"
            aria-hidden="true"
          >
            <Code className="size-4 sm:size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 
              id={`program-${program.programId}-title`}
              className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors truncate"
            >
              {program.programName}
            </h3>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-mono">
              {truncateAddress(program.programId, 4)}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge 
            variant="outline" 
            className="bg-primary/10 text-primary border-primary/20 text-[10px] sm:text-xs font-mono px-1.5 py-0"
          >
            {program.version}
          </Badge>
          <Badge 
            variant="outline" 
            className={`${categoryStyle.bg} ${categoryStyle.text} border-0 text-[10px] sm:text-xs px-1.5 py-0`}
          >
            {program.category}
          </Badge>
        </div>
      </div>
      
      {/* Description */}
      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-3">
        {program.description}
      </p>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-md bg-background/50 p-2 border border-border/30">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-0.5">
            <Code className="size-2.5" aria-hidden="true" />
            <span>Instructions</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-primary">
            {program.instructionCount}
          </p>
        </div>
        <div className="rounded-md bg-background/50 p-2 border border-border/30">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-0.5">
            <GitBranch className="size-2.5" aria-hidden="true" />
            <span>Deployments</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-secondary">
            {program.deploymentCount}
          </p>
        </div>
      </div>
      
      {/* Meta Info */}
      <div className="flex items-center gap-3 text-[10px] sm:text-xs text-muted-foreground mb-3">
        <div className="flex items-center gap-1">
          <User className="size-2.5 sm:size-3" aria-hidden="true" />
          <span className="font-mono">{truncateAddress(program.creator, 3)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="size-2.5 sm:size-3" aria-hidden="true" />
          <span>{formatRelativeTime(program.registeredAt)}</span>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="flex-1 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground h-7 sm:h-8 text-[10px] sm:text-xs"
        >
          <a
            href={getSolanaExplorerUrl(program.programId)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${program.programName} on Solana Explorer (opens in new tab)`}
          >
            <ExternalLink className="size-3 mr-1" aria-hidden="true" />
            <span className="hidden xs:inline">Program on </span>Explorer
          </a>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-7 sm:h-8 text-[10px] sm:text-xs"
        >
          <a
            href={getSolanaExplorerUrl(program.registryPda)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${program.programName} registry entry on Solana Explorer (opens in new tab)`}
          >
            <Eye className="size-3 mr-1" aria-hidden="true" />
            Registry
          </a>
        </Button>
      </div>
    </article>
  );
}
