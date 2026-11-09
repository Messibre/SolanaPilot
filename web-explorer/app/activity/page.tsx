import { Metadata } from "next";
import { Header, MobileNav } from "@/components/registry/header";
import { Footer } from "@/components/registry/footer";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Activity | SolanaPilot Registry",
  description: "View recent deployment activity and program updates on the SolanaPilot registry.",
};

export default function ActivityPage() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div className="min-h-screen flex flex-col bg-bg text-text">
        <Header />

        <main
          id="main-content"
          className="flex-1 container mx-auto px-4 py-8"
          tabIndex={-1}
        >
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-lg border border-border bg-surface">
            <div
              className="size-12 rounded-lg bg-surface-2 flex items-center justify-center mb-3 border border-border"
              aria-hidden="true"
            >
              <Activity className="size-6 text-accent" />
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-1">
              On-Chain Activity
            </h1>
            <p className="text-text-muted text-xs max-w-sm mb-5">
              Live registration and update events from the SolanaPilot on-chain Anchor program on Solana devnet.
            </p>
            <Button size="sm" className="bg-accent text-accent-fg hover:opacity-90 text-xs">
              Connect Wallet
            </Button>
          </div>
        </main>

        <Footer />
        <MobileNav />
      </div>
    </>
  );
}
