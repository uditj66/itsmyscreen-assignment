"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Home, RefreshCw } from "lucide-react";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to console in development for debugging
    if (process.env.NODE_ENV === "development") {
      console.error("[Error boundary]", error);
    }
  }, [error]);

  const isNotFound =
    error.message?.toLowerCase().includes("not found") ||
    error.digest === "NOT_FOUND";

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
          </div>
          <CardTitle className="text-xl">
            {isNotFound ? "Page not found" : "Something went wrong"}
          </CardTitle>
          <CardDescription>
            {isNotFound
              ? "The page you’re looking for doesn’t exist or may have been moved."
              : "An unexpected error occurred. You can try again or go back home."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive" className="border-destructive/50">
            <AlertDescription className="break-words font-mono text-sm">
              {error.message || "Unknown error"}
            </AlertDescription>
          </Alert>
          {error.digest && (
            <p className="text-center text-xs text-muted-foreground">
              Reference: {error.digest}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="default"
            className="w-full gap-2 sm:w-auto"
            onClick={reset}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Try again
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 sm:w-auto"
            asChild
          >
            <Link href="/">
              <Home className="h-4 w-4" aria-hidden />
              Back to home
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
