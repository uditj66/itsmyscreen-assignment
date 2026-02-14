"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function AuthStatus() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="h-9 w-20 animate-pulse rounded-md bg-muted" aria-hidden />
    );
  }

  if (status === "authenticated" && session?.user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground truncate max-w-[120px]">
          {session.user.name ?? session.user.email ?? "Signed in"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
        >
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => signIn("google")} className="gap-2">
      <img src="/google.svg" alt="" className="h-5 w-5" aria-hidden />
      Sign in with Google
    </Button>
  );
}
