import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Poll } from "@/models/Poll";
import { sendPollUpdateToSSE } from "@/lib/sse";

const voteSchema = z.object({
  optionIndex: z.number().int().min(0),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "Database unavailable." },
      { status: 503 }
    );
  }

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Invalid poll ID." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = voteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Invalid option index." },
        { status: 400 }
      );
    }

    const poll = await Poll.findById(id);

    if (!poll) {
      return NextResponse.json(
        { success: false, message: "Poll not found." },
        { status: 404 }
      );
    }

    const { optionIndex } = parsed.data;

    if (optionIndex >= poll.options.length) {
      return NextResponse.json(
        { success: false, message: "Invalid option index." },
        { status: 400 }
      );
    }

    poll.options[optionIndex].votes += 1;
    await poll.save();

    const totalVotes = poll.options.reduce(
      (sum: number, o: { text: string; votes: number }) => sum + o.votes,
      0
    );
    await sendPollUpdateToSSE(id, {
      question: poll.question,
      options: poll.options,
      totalVotes,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to record vote." },
      { status: 500 }
    );
  }
}
