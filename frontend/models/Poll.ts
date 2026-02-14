import mongoose, { Schema, model, models } from "mongoose";

const optionSchema = new Schema(
  {
    text: { type: String, required: true },
    votes: { type: Number, default: 0 },
  },
  { _id: false }
);

const pollSchema = new Schema(
  {
    question: {
      type: String,
      required: true,
      minlength: 5,
    },
    options: {
      type: [optionSchema],
      required: true,
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length >= 2,
        message: "Poll must have at least 2 options.",
      },
    },
  },
  { timestamps: true }
);

export const Poll = models.Poll ?? model("Poll", pollSchema);
