// Server component - no hydration issues
const CURRENT_YEAR = 2026;

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/30 py-4 sm:py-6 pb-20 md:pb-6">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          {/* Left side */}
          <div className="text-center sm:text-left">
            <p className="font-semibold text-foreground text-sm">SolanaPilot Registry</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Anchor + Solana devnet
            </p>
          </div>
          
          {/* Right side - Registry Program */}
          <div className="text-center sm:text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
              Registry Program
            </p>
            <code className="text-[10px] sm:text-xs font-mono text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded break-all">
              Xa7TcdZwxZMzU254am9r86n1L5L9ppmkqFLBpCXo85ps
            </code>
          </div>
        </div>
        
        {/* Copyright */}
        <div className="mt-4 pt-4 border-t border-border/30 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            &copy; {CURRENT_YEAR} SolanaPilot. All program registrations are verifiable on-chain.
          </p>
        </div>
      </div>
    </footer>
  );
}
