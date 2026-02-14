import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Poll } from "@/models/Poll";

const createPollSchema = z.object({
  question: z.string().min(1, "Question is required").transform((s) => s.trim()).pipe(z.string().min(5, "Question must be at least 5 characters")),
  options: z
    .array(z.string().transform((s) => s.trim()).pipe(z.string().min(1, "Option cannot be empty")))
    .min(2, "At least 2 options are required"),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "Database unavailable." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createPollSchema.safeParse(body);

    if (!parsed.success) {
      const first = parsed.error.flatten().formErrors[0] ?? parsed.error.message;
      return NextResponse.json(
        { success: false, message: typeof first === "string" ? first : "Validation failed." },
        { status: 400 }
      );
    }

    const { question, options } = parsed.data;

    const poll = await Poll.create({
      question,
      options: options.map((text) => ({ text, votes: 0 })),
      voters: [],
    });

    return NextResponse.json({
      success: true,
      data: {
        id: poll._id.toString(),
        question: poll.question,
        options: poll.options,
        createdAt: poll.createdAt,
        updatedAt: poll.updatedAt,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create poll." },
      { status: 500 }
    );
  }
}
