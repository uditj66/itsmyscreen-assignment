import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectDB } from "@/lib/db";
import { Poll } from "@/models/Poll";

function toPublicPoll(
  poll: {
    _id: unknown;
    question: string;
    options: { text: string; votes: number }[];
    createdAt?: Date;
    updatedAt?: Date;
  },
  hasVoted?: boolean
) {
  return {
    id: String(poll._id),
    question: poll.question,
    options: poll.options,
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt,
    ...(typeof hasVoted === "boolean" && { hasVoted }),
  };
}

export async function GET(
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

    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
    });
    const userId = (token?.id ?? token?.sub) ?? null;

    const poll = userId
      ? await Poll.findById(id).select("+voterUserIds").lean()
      : await Poll.findById(id).lean();

    if (!poll) {
      return NextResponse.json(
        { success: false, message: "Poll not found." },
        { status: 404 }
      );
    }

    const voterIds = (poll as { voterUserIds?: string[] }).voterUserIds ?? [];
    const hasVoted = userId ? voterIds.includes(userId) : undefined;

    return NextResponse.json({
      success: true,
      data: toPublicPoll(poll, hasVoted),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to fetch poll." },
      { status: 500 }
    );
  }
}
