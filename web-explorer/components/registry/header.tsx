"use client";

import { Compass, FolderCode, Activity, User } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/", label: "Explorer", icon: Compass },
  { href: "/programs", label: "My Programs", icon: FolderCode },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/profile", label: "Profile", icon: User },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="container mx-auto px-4">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="SolanaPilot home"
          >
            <Image
              src="/images/logo.png"
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-md"
              aria-hidden="true"
              priority
            />
            <div className="hidden xs:block">
              <span className="font-semibold text-sm tracking-tight text-foreground">
                SolanaPilot
              </span>
              <p className="text-[10px] text-text-muted font-mono -mt-0.5">
                Registry
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    isActive
                      ? "bg-surface-2 text-foreground font-semibold"
                      : "text-text-muted hover:text-foreground hover:bg-surface-2/60"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon className="size-3.5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Actions: Network pill, Theme toggle, Sign-in slot */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-border text-[11px] font-medium text-text-muted">
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              <span>Devnet</span>
            </div>

            <ThemeToggle />

            <Link
              href="/profile"
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-foreground hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around py-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent min-w-[56px]",
                isActive ? "text-accent font-semibold" : "text-text-muted hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className="size-4" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
