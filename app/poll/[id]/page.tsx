"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
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
import { Loader2 } from "lucide-react";

const POLL_INTERVAL_MS = 2000;

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

export default function PollPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPoll = useCallback(async (): Promise<PollData | null> => {
    if (!id) return null;
    try {
      const res = await fetch(`/api/poll/${id}`);
      const json: ApiResponse = await res.json();

      if (!res.ok || !json.success || !("data" in json)) {
        setError("message" in json ? json.message : "Failed to load poll.");
        return null;
      }

      setPoll(json.data);
      setError(null);
      return json.data;
    } catch {
      setError("Network error. Please try again.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  useEffect(() => {
    if (!id || hasVoted) return;

    intervalRef.current = setInterval(() => {
      fetch(`/api/poll/${id}`)
        .then((res) => res.json())
        .then((json: ApiResponse) => {
          if (json.success && "data" in json) {
            setPoll(json.data);
          }
        })
        .catch(() => {});
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [id, hasVoted, fetchPoll]);

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
      const json: ApiResponse = await res.json();

      if (!res.ok || !json.success) {
        setError("message" in json ? json.message : "Failed to vote.");
        return;
      }

      if ("data" in json) {
        setPoll(json.data);
        setHasVoted(true);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
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
        {!hasVoted && (
          <p className="text-center text-sm text-muted-foreground" aria-live="polite">
            Live updating…
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{poll.question}</CardTitle>
            <CardDescription>
              {totalVotes} vote{totalVotes !== 1 ? "s" : ""} total
            </CardDescription>
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
