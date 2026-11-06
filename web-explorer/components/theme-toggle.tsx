"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="size-9 rounded-md border border-border bg-surface"
        aria-hidden="true"
      />
    );
  }

  const cycleTheme = () => {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  };

  const getLabel = () => {
    if (theme === "light") return "Theme: Light (click to switch to Dark)";
    if (theme === "dark") return "Theme: Dark (click to switch to System)";
    return "Theme: System (click to switch to Light)";
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={getLabel()}
      title={getLabel()}
      className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {theme === "light" && <Sun className="size-4 text-foreground" />}
      {theme === "dark" && <Moon className="size-4 text-foreground" />}
      {theme === "system" && <Monitor className="size-4 text-foreground" />}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
