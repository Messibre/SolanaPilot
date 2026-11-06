import { Metadata } from "next";
import { Header, MobileNav } from "@/components/registry/header";
import { Footer } from "@/components/registry/footer";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Profile | SolanaPilot Registry",
  description: "View and manage your SolanaPilot developer profile and program statistics.",
};

export default function ProfilePage() {
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
              <User className="size-6 text-accent" />
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-1">
              Developer Profile
            </h1>
            <p className="text-text-muted text-xs max-w-sm mb-5">
              Connect your Solana wallet or sign in with GitHub to link identities, view your deployed programs, and manage authority.
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
