"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Copy, Check } from "lucide-react";

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
};

type ApiResponse =
  | { success: true; data: PollData }
  | { success: false; message: string };

const sseBaseUrl = process.env.NEXT_PUBLIC_SSE_SERVER_URL ?? "";

export default function PollPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Loading poll…</p>
        </div>
      </main>
    );
  }

  if (error && !poll) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!poll) {
    return null;
  }

  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-lg space-y-4">
        {!hasVoted && sseBaseUrl && (
          <p className="text-center text-sm text-muted-foreground" aria-live="polite">
            Live
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{poll.question}</CardTitle>
            <CardDescription>
              {totalVotes} vote{totalVotes !== 1 ? "s" : ""} total
            </CardDescription>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyPollLink}
              className="mt-2 w-fit"
              aria-label={copiedLink ? "Link copied" : "Copy poll link"}
            >
              {copiedLink ? (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden />
                  Copy link
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {hasVoted ? (
              <p className="text-sm text-muted-foreground">You have already voted.</p>
            ) : null}

            <div className="space-y-3">
              {poll.options.map((opt, i) => {
                const pct = totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0;
                const pctText = `${pct.toFixed(1)}%`;

                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{opt.text}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {opt.votes} vote{opt.votes !== 1 ? "s" : ""} · {pctText}
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </div>

            {!hasVoted && (
              <div className="flex flex-wrap gap-2 pt-2">
                {poll.options.map((opt, i) => (
                  <Button
                    key={i}
                    type="button"
                    variant={selectedOption === i ? "default" : "outline"}
                    disabled={voting}
                    onClick={() => setSelectedOption(i)}
                    aria-pressed={selectedOption === i}
                    aria-label={`Vote for ${opt.text}`}
                  >
                    {opt.text}
                  </Button>
                ))}
              </div>
            )}

            {!hasVoted && selectedOption !== null && (
              <Button
                className="w-full"
                disabled={voting}
                onClick={handleVote}
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
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
