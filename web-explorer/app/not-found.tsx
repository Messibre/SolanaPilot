import { FileQuestion, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-bg text-text">
      <div className="text-center max-w-md rounded-lg border border-border bg-surface p-8">
        <div className="size-12 rounded-lg bg-surface-2 flex items-center justify-center mb-3 border border-border mx-auto">
          <FileQuestion className="size-6 text-text-muted" />
        </div>

        <h1 className="text-lg font-semibold text-foreground mb-1">
          404 — Page Not Found
        </h1>

        <p className="text-xs text-text-muted mb-6">
          The requested registry page or route could not be found.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-border text-foreground hover:bg-surface-2 text-xs"
          >
            <Link href="/">
              <Home className="size-3.5 mr-1.5" />
              Return to Explorer
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
