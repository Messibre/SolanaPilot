import { Header, MobileNav } from "@/components/registry/header";
import { Footer } from "@/components/registry/footer";
import { RegistryExplorer } from "@/components/registry/registry-explorer";

export default function HomePage() {
  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a 
        href="#main-content" 
        className="skip-link"
      >
        Skip to main content
      </a>
      
      <div className="min-h-screen flex flex-col">
        <Header />
        
        <main 
          id="main-content"
          className="flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8"
          tabIndex={-1}
        >
          <RegistryExplorer />
        </main>
        
        <Footer />
        <MobileNav />
      </div>
    </>
  );
}
