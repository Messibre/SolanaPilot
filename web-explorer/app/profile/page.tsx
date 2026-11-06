import { Metadata } from "next";
import { Header, MobileNav } from "@/components/registry/header";
import { Footer } from "@/components/registry/footer";
import { ProfileView } from "./profile-view";

export const metadata: Metadata = {
  title: "Profile | SolanaPilot Registry",
  description: "View and manage your SolanaPilot developer profile and linked authentication identities.",
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
          <ProfileView />
        </main>

        <Footer />
        <MobileNav />
      </div>
    </>
  );
}
