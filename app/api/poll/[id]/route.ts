import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Poll } from "@/models/Poll";

function toPublicPoll(poll: { _id: unknown; question: string; options: { text: string; votes: number }[]; createdAt?: Date; updatedAt?: Date }) {
  return {
    id: String(poll._id),
    question: poll.question,
    options: poll.options,
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt,
  };
}

export async function GET(
  _request: NextRequest,
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

    const poll = await Poll.findById(id).lean();

    if (!poll) {
      return NextResponse.json(
        { success: false, message: "Poll not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: toPublicPoll(poll),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to fetch poll." },
      { status: 500 }
    );
  }
}
