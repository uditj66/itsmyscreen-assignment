import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
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
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });
  const userId = token?.sub ?? null;
  if (!userId) {
    return NextResponse.json(
      { success: false, message: "Sign in with Google to vote." },
      { status: 401 }
    );
  }

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

    const poll = await Poll.findById(id).select("+voterUserIds").lean();

    if (!poll) {
      return NextResponse.json(
        { success: false, message: "Poll not found." },
        { status: 404 }
      );
    }

    const voterIds = (poll as { voterUserIds?: string[] }).voterUserIds ?? [];
    if (voterIds.includes(userId)) {
      return NextResponse.json(
        { success: false, message: "You have already voted." },
        { status: 409 }
      );
    }

    const { optionIndex } = parsed.data;

    if (optionIndex >= poll.options.length) {
      return NextResponse.json(
        { success: false, message: "Invalid option index." },
        { status: 400 }
      );
    }

    const updated = await Poll.findByIdAndUpdate(
      id,
      {
        $inc: { [`options.${optionIndex}.votes`]: 1 },
        $push: { voterUserIds: userId },
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Failed to record vote." },
        { status: 500 }
      );
    }

    const totalVotes = updated.options.reduce(
      (sum: number, o: { text: string; votes: number }) => sum + o.votes,
      0
    );
    await sendPollUpdateToSSE(id, {
      question: updated.question,
      options: updated.options,
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
