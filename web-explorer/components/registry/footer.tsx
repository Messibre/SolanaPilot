import { getSolanaExplorerUrl } from "@/lib/mock-data";

const CURRENT_YEAR = 2026;
const PROGRAM_ID = "HsgU4dZEKDmWbSufhdA6zJrdz6RJDaSzrN5VQToCDpXa";

export function Footer() {
  const explorerUrl = getSolanaExplorerUrl(PROGRAM_ID);

  return (
    <footer className="border-t border-border bg-surface py-6 pb-20 md:pb-6 text-xs text-text-muted">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="font-semibold text-foreground text-sm">SolanaPilot Registry</p>
            <p className="text-xs text-text-muted mt-0.5">
              Anchor 0.31 on Solana devnet
            </p>
          </div>

          <div className="text-center sm:text-right">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1 font-mono">
              Registry Program ID
            </p>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-accent hover:underline break-all"
            >
              {PROGRAM_ID}
            </a>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border text-center text-[11px] text-text-muted">
          &copy; {CURRENT_YEAR} SolanaPilot. All program registrations verifiable on-chain.
        </div>
      </div>
    </footer>
  );
}
