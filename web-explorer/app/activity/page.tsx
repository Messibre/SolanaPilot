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
      
      <div className="min-h-screen flex flex-col">
        <Header />
        
        <main 
          id="main-content"
          className="flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8"
          tabIndex={-1}
        >
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center">
            <div 
              className="size-16 sm:size-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/10 flex items-center justify-center mb-4 sm:mb-6 border border-primary/20"
              aria-hidden="true"
            >
              <Activity className="size-8 sm:size-10 text-primary/60" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
              Registry Activity
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-sm mb-4 sm:mb-6">
              Connect your wallet to view recent deployment activity and program updates.
            </p>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm">
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
