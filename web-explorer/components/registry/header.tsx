"use client";

import { Compass, FolderCode, Activity, User } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Explorer", icon: Compass },
  { href: "/programs", label: "My Programs", icon: FolderCode },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/profile", label: "Profile", icon: User },
];

export function Header() {
  const pathname = usePathname();
  
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-xl">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex h-14 sm:h-16 items-center justify-between">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md"
            aria-label="SolanaPilot home"
          >
            <Image 
              src="/images/logo.png"
              alt=""
              width={36}
              height={36}
              className="size-8 sm:size-9 rounded-lg"
              aria-hidden="true"
              priority
            />
            <div className="hidden xs:block">
              <span className="font-bold text-sm sm:text-base tracking-tight gradient-text">
                SOLANAPILOT
              </span>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground -mt-0.5 font-mono">
                Registry v1.0.0
              </p>
            </div>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-0.5" aria-label="Main navigation">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon className="size-3.5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          
          {/* Network Badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
              <span className="text-[10px] sm:text-xs font-medium text-primary">Devnet</span>
            </div>
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
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden safe-area-inset-bottom"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around py-1.5 pb-safe">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-w-[60px]",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className={cn("size-4", isActive && "text-primary")} aria-hidden="true" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
