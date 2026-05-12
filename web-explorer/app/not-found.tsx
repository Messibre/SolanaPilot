import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="text-center max-w-md">
        <div className="size-16 sm:size-20 rounded-xl sm:rounded-2xl bg-muted/50 flex items-center justify-center mb-4 sm:mb-6 border border-border/50 mx-auto">
          <FileQuestion className="size-8 sm:size-10 text-muted-foreground" />
        </div>
        
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
          Page not found
        </h1>
        
        <p className="text-xs sm:text-sm text-muted-foreground mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full sm:w-auto border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <Link href="/">
              <Home className="size-4 mr-2" />
              Go Home
            </Link>
          </Button>
          
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full sm:w-auto"
          >
            <Link href="javascript:history.back()">
              <ArrowLeft className="size-4 mr-2" />
              Go Back
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
