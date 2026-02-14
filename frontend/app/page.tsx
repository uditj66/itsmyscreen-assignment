"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
        .pipe(z.string().min(1, "Option cannot be empty"))
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
    setValue("options", [...options, ""], { shouldValidate: true });
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setValue(
      "options",
      options.filter((_, i) => i !== index),
      { shouldValidate: true }
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
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Create a poll</CardTitle>
            <CardDescription>Add a question and at least two options.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {errors.root && (
                <Alert variant="destructive">
                  <AlertDescription>{errors.root.message}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="question">Question</Label>
                <Input
                  id="question"
                  placeholder="Your question"
                  {...register("question")}
                />
                {errors.question && (
                  <p className="text-sm text-destructive">{errors.question.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Options (minimum 2)</Label>
                <div className="space-y-2">
                  {options.map((_, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex gap-2">
                        <Input
                          placeholder={`Option ${i + 1}`}
                          {...register(`options.${i}`)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeOption(i)}
                          disabled={options.length <= 2}
                          aria-label={`Remove option ${i + 1}`}
                        >
                          −
                        </Button>
                      </div>
                      {errors.options?.[i] && (
                        <p className="text-sm text-destructive">
                          {errors.options[i].message}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {errors.options && typeof errors.options.message === "string" && (
                  <p className="text-sm text-destructive">
                    {errors.options.message}
                  </p>
                )}
                <Button type="button" variant="secondary" onClick={addOption}>
                  Add option
                </Button>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Creating…" : "Create poll"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
