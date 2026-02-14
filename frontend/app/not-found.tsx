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
import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="h-6 w-6 text-muted-foreground" aria-hidden />
          </div>
          <CardTitle className="text-xl">Page not found</CardTitle>
          <CardDescription>
            The page you’re looking for doesn’t exist or the URL may be wrong.
            Check the address or go back to the home page to create or open a
            poll.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground">
            You can create a new poll from the home page or use a valid poll
            link (e.g. <code className="rounded bg-muted px-1 py-0.5">/poll/...</code>).
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button type="button" variant="default" className="gap-2" asChild>
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
