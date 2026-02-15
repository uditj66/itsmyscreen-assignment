const SSE_SERVER_URL = process.env.SSE_SERVER_URL ?? "";
const SSE_SECRET = process.env.SSE_SECRET ?? "";

export type PollUpdateSummary = {
  question: string;
  options: { text: string; votes: number }[];
  totalVotes: number;
};

export async function sendPollUpdateToSSE(
  pollId: string,
  summary: PollUpdateSummary
): Promise<{ deliveredTo: number } | null> {
  if (!SSE_SERVER_URL || !SSE_SECRET) {
    return null;
  }
  try {
    const res = await fetch(`${SSE_SERVER_URL.replace(/\/$/, "")}/notify/${pollId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SSE_SECRET}`,
      },
      body: JSON.stringify({
        question: summary.question,
        options: summary.options,
        totalVotes: summary.totalVotes,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success === true && typeof json.deliveredTo === "number") {
      return { deliveredTo: json.deliveredTo };
    }
    return null;
  } catch {
    return null;
  }
}
