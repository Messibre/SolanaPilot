import { Metadata } from "next";
import { Header, MobileNav } from "@/components/registry/header";
import { Footer } from "@/components/registry/footer";
import { FolderCode } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "My Programs | SolanaPilot Registry",
  description: "View and manage your registered Solana programs on the SolanaPilot registry.",
};

export default function MyProgramsPage() {
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
              <FolderCode className="size-6 text-accent" />
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-1">
              My Registered Programs
            </h1>
            <p className="text-text-muted text-xs max-w-sm mb-5">
              Connect your Solana devnet wallet to manage authority, inspect deployments, and review metadata for your registered programs.
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
