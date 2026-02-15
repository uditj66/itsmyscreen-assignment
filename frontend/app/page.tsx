"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, Sparkles } from "lucide-react";

const createPollSchema = z.object({
  question: z
    .string()
    .min(1, "Question is required")
    .transform((s) => s.trim())
    .pipe(z.string().min(5, "Question must be at least 5 characters")),
  options: z
    .array(
      z
        .string()
        .min(1, "Option cannot be empty")
        .transform((s) => s.trim())
        .pipe(z.string().min(1, "Option cannot be empty")),
    )
    .min(2, "At least 2 options are required"),
});

type CreatePollForm = z.infer<typeof createPollSchema>;

export default function HomePage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    setValue,
    watch,
  } = useForm<CreatePollForm>({
    resolver: zodResolver(createPollSchema),
    defaultValues: {
      question: "",
      options: ["", ""],
    },
  });

  const options = watch("options") ?? ["", ""];

  const addOption = () => {
    setValue("options", [...options, ""], { shouldValidate: false });
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setValue(
      "options",
      options.filter((_, i) => i !== index),
      { shouldValidate: false },
    );
  };

  const onSubmit = async (data: CreatePollForm) => {
    const res = await fetch("/api/poll/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: data.question.trim(),
        options: data.options.map((o) => o.trim()).filter(Boolean),
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError("root", { message: json.message ?? "Failed to create poll." });
      return;
    }

    if (json.success && json.data?.id) {
      router.push(`/poll/${json.data.id}`);
    } else {
      setError("root", { message: "Failed to create poll." });
    }
  };

  return (
    <main className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-zinc-950">
      {/* Subtle gradient + soft glow */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(120,119,198,0.15),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-zinc-700/50 to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md flex-col justify-center px-5 py-12 sm:px-6">
        {/* Headline */}
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs font-medium text-zinc-400">
            Real-time results
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Create a poll
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            One question, a few choices — share the link and watch votes live.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 shadow-xl shadow-black/20 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-6 p-6 sm:p-8"
          >
            {errors.root && (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-300"
              >
                {errors.root.message}
              </div>
            )}

            {/* Question */}
            <div className="space-y-2">
              <label
                htmlFor="question"
                className="text-xs font-medium uppercase tracking-wider text-zinc-500"
              >
                Question
              </label>
              <Input
                id="question"
                placeholder="What should we do next?"
                className="min-h-[48px] rounded-xl border-zinc-700/80 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus-visible:border-amber-500/50 focus-visible:ring-amber-500/20"
                {...register("question")}
              />
              {errors.question && (
                <p className="text-xs text-rose-400">
                  {errors.question.message}
                </p>
              )}
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Options
              </label>
              <div className="space-y-2">
                {options.map((_, i) => (
                  <div key={i} className="group flex gap-2">
                    <Input
                      placeholder={`Option ${i + 1}`}
                      className="min-h-[44px] rounded-xl border-zinc-700/80 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus-visible:border-amber-500/50 focus-visible:ring-amber-500/20"
                      {...register(`options.${i}`)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(i)}
                      disabled={options.length <= 2}
                      aria-label={`Remove option ${i + 1}`}
                      className="h-11 w-11 shrink-0 rounded-xl text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-30"
                    >
                      −
                    </Button>
                  </div>
                ))}
              </div>
              {errors.options?.[0] && (
                <p className="text-xs text-rose-400">
                  {typeof errors.options[0]?.message === "string"
                    ? errors.options[0].message
                    : "Option cannot be empty."}
                </p>
              )}
              {errors.options && typeof errors.options.message === "string" && (
                <p className="text-xs text-rose-400">
                  {errors.options.message}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={addOption}
                className="h-11 w-full rounded-xl border-dashed border-zinc-600 bg-transparent text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add option
              </Button>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full rounded-xl bg-amber-500 font-medium text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 focus-visible:ring-amber-400/40 disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Creating…
                </>
              ) : (
                "Create poll"
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Minimum 2 options · Share the link to collect votes
        </p>
      </div>
    </main>
  );
}
