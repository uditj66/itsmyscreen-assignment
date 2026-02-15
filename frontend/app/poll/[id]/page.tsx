"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Check, ClipboardCopyIcon } from "lucide-react";

const ssePayloadSchema = z.object({
  question: z.string(),
  options: z.array(
    z.object({
      text: z.string(),
      votes: z.number(),
    })
  ),
  totalVotes: z.number().optional(),
});

type PollOption = {
  text: string;
  votes: number;
};

type PollData = {
  id: string;
  question: string;
  options: PollOption[];
  createdAt?: string;
  updatedAt?: string;
  hasVoted?: boolean;
};

type ApiResponse =
  | { success: true; data: PollData }
  | { success: false; message: string };

const sseBaseUrl = process.env.NEXT_PUBLIC_SSE_SERVER_URL ?? "";

export default function PollPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { data: session, status: sessionStatus } = useSession();
  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [voteConfirmOpen, setVoteConfirmOpen] = useState(false);

  const isAuthenticated = sessionStatus === "authenticated";
  const canVote = isAuthenticated && !hasVoted;

  const copyPollLink = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/poll/${id}`);
        const json: ApiResponse = await res.json();

        if (cancelled) return;

        if (!res.ok || !json.success || !("data" in json)) {
          setError("message" in json ? json.message : "Failed to load poll.");
          setLoading(false);
          return;
        }

        setPoll(json.data);
        setHasVoted(Boolean(json.data.hasVoted));
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Network error. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !sseBaseUrl) return;

    const url = `${sseBaseUrl.replace(/\/$/, "")}/stream/${id}`;
    const eventSource = new EventSource(url);

    eventSource.addEventListener("update", (event: MessageEvent) => {
      try {
        const raw = JSON.parse(event.data as string);
        const parsed = ssePayloadSchema.safeParse(raw);
        if (!parsed.success) return;

        const { question, options } = parsed.data;
        setPoll((prev) => {
          if (!prev) return null;
          return { ...prev, question, options };
        });
      } catch {
        // ignore invalid payload
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [id]);

  const handleVote = async () => {
    if (poll == null || selectedOption == null) return;
    setVoting(true);
    setError(null);
    try {
      const res = await fetch(`/api/poll/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIndex: selectedOption }),
      });
      const json = await res.json();

      if (res.status === 401) {
        setError("message" in json ? json.message : "Sign in with Google to vote.");
        return;
      }
      if (res.status === 409) {
        setHasVoted(true);
        setError(null);
        return;
      }
      if (!res.ok || !json.success) {
        setError("message" in json ? json.message : "Failed to vote.");
        return;
      }

      setHasVoted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setVoting(false);
    }
  };

  const handleSignIn = () => {
    const callbackUrl = typeof window !== "undefined" ? window.location.href : "/";
    signIn("google", { callbackUrl });
  };

  if (loading) {
    return (
      <main className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden bg-zinc-950 p-4">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(120,119,198,0.12),transparent)]"
          aria-hidden
        />
        <div className="relative flex flex-col items-center gap-4">
          <Loader2
            className="h-8 w-8 animate-spin text-zinc-500"
            aria-hidden
          />
          <p className="text-sm text-zinc-500">Loading poll…</p>
        </div>
      </main>
    );
  }

  if (error && !poll) {
    return (
      <main className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden bg-zinc-950 p-4">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(120,119,198,0.12),transparent)]"
          aria-hidden
        />
        <div className="relative w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-white">Error</h2>
          <div
            role="alert"
            className="mt-3 rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-300"
          >
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!poll) {
    return null;
  }

  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);

  return (
    <main className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-zinc-950">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(120,119,198,0.15),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-zinc-700/50 to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto max-w-lg px-5 py-10 sm:px-6 sm:py-12">
        {/* Live indicator */}
        {canVote && sseBaseUrl && (
          <div
            className="mb-6 flex items-center justify-center gap-2"
            aria-live="polite"
          >
            <span
              className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"
              aria-hidden
            />
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Live
            </span>
          </div>
        )}

        {/* Poll card */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 shadow-xl shadow-black/20 backdrop-blur-sm">
          <div className="p-6 sm:p-8">
            {/* Question + meta */}
            <div className="mb-6">
              <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {poll.question}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {totalVotes} vote{totalVotes !== 1 ? "s" : ""} total
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={copyPollLink}
                  className="h-8 gap-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                  aria-label={copiedLink ? "Link copied" : "Copy poll link"}
                >
                  {copiedLink ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      <span className="text-xs">Copied</span>
                    </>
                  ) : (
                    <>
                      <ClipboardCopyIcon className="h-3.5 w-3.5" aria-hidden />
                      <span className="text-xs">Copy link</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-300"
              >
                {error}
              </div>
            )}

            {hasVoted && (
              <p className="mb-4 text-sm text-zinc-500">
                You have already voted.
              </p>
            )}

            {/* Results */}
            <div className="space-y-4">
              {poll.options.map((opt, i) => {
                const pct = totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0;
                const pctText = `${pct.toFixed(1)}%`;

                return (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-white">{opt.text}</span>
                      <span className="tabular-nums text-zinc-500">
                        {opt.votes} vote{opt.votes !== 1 ? "s" : ""} · {pctText}
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      className="h-2 rounded-full bg-zinc-800 [&>div]:rounded-full [&>div]:bg-amber-500"
                    />
                  </div>
                );
              })}
            </div>

            {/* Sign in to vote */}
            {!isAuthenticated && !hasVoted && (
              <div className="mt-6 rounded-xl border border-dashed border-zinc-700 bg-zinc-800/30 p-5 text-center">
                <p className="mb-4 text-sm text-zinc-500">
                  Sign in with Google to vote. One vote per user.
                </p>
                <Button
                  onClick={handleSignIn}
                  className="h-11 w-full rounded-xl bg-white font-medium text-zinc-950 hover:bg-zinc-200"
                >
                  <img src="/google.svg" alt="" className="h-5 w-5" aria-hidden />
                  Sign in with Google
                </Button>
              </div>
            )}

            {/* Vote options + submit */}
            {canVote && (
              <div className="mt-6 space-y-4">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Your choice
                </p>
                <div className="flex flex-wrap gap-2">
                  {poll.options.map((opt, i) => (
                    <Button
                      key={i}
                      type="button"
                      disabled={voting}
                      onClick={() => setSelectedOption(i)}
                      aria-pressed={selectedOption === i}
                      aria-label={`Vote for ${opt.text}`}
                      className={`h-11 rounded-xl px-4 transition ${
                        selectedOption === i
                          ? "bg-amber-500 text-zinc-950 hover:bg-amber-400"
                          : "border border-zinc-600 bg-zinc-800/50 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800"
                      }`}
                    >
                      {opt.text}
                    </Button>
                  ))}
                </div>

                {selectedOption !== null && (
                  <>
                    <Button
                      type="button"
                      disabled={voting}
                      onClick={() => setVoteConfirmOpen(true)}
                      className="h-12 w-full rounded-xl bg-amber-500 font-medium text-zinc-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 focus-visible:ring-amber-400/40 disabled:opacity-70"
                    >
                      {voting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Voting…
                        </>
                      ) : (
                        "Submit vote"
                      )}
                    </Button>
                    <AlertDialog
                      open={voteConfirmOpen}
                      onOpenChange={setVoteConfirmOpen}
                    >
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm your vote</AlertDialogTitle>
                          <AlertDialogDescription>
                            You can&apos;t change the opted choice once you
                            submit the vote.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleVote()}>
                            Confirm vote
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
