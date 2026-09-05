"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Captions, FileText, Languages, PenLine, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLessonLanguages, useRecentTopics } from "@/hooks/useLessons";
import { cn } from "@/lib/utils";
import type { LessonLanguageOption } from "@/lib/types";

const MAX_PDF_MB = 20;

const generateSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(3, "Give the topic at least 3 characters")
    .max(200, "Keep the topic under 200 characters"),
  focus: z.string().trim().max(300, "Keep the focus under 300 characters").optional(),
  /** 0 = auto (matched to the learner profile). */
  durationMin: z.number().int().min(0).max(30),
  detailLevel: z.enum(["quick", "standard", "detailed"]),
  subtitles: z.boolean(),
  language: z.enum(["en", "hi", "te", "ta", "es"]),
  /**
   * What gets WRITTEN on the board. "same" follows the narration language;
   * anything else writes the board in that language while the voice stays put.
   */
  boardLanguage: z.enum(["same", "en", "hi", "te", "ta", "es"]),
});

export type GenerateValues = z.infer<typeof generateSchema>;

const DURATION_CHOICES = [
  { value: 0, label: "Auto" },
  { value: 2, label: "2 min" },
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
];

/** Shown until GET /generate/languages resolves — mirrors the server registry. */
const FALLBACK_LANGUAGES: LessonLanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English", locale: "en-US" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", locale: "hi-IN" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు", locale: "te-IN" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்", locale: "ta-IN" },
  { code: "es", label: "Spanish", nativeLabel: "Español", locale: "es-ES" },
];

const DETAIL_CHOICES: { value: GenerateValues["detailLevel"]; label: string; hint: string }[] = [
  { value: "quick", label: "Quick", hint: "high-level essentials" },
  { value: "standard", label: "Standard", hint: "balanced depth" },
  { value: "detailed", label: "In-depth", hint: "the why, worked examples, board notes" },
];

interface GenerateFormProps {
  onGenerate: (values: GenerateValues, sourceFile?: File) => void;
  disabled: boolean;
  /** Prefilled when generating a Learning Path module. */
  defaultTopic?: string;
  defaultFocus?: string;
  /** Prefilled narration language when generating a Learning Path module. */
  defaultLanguage?: string;
}

const LESSON_LANGUAGE_CODES = ["en", "hi", "te", "ta", "es"] as const;

function toLessonLanguage(value: string | undefined): GenerateValues["language"] {
  return (LESSON_LANGUAGE_CODES as readonly string[]).includes(value ?? "")
    ? (value as GenerateValues["language"])
    : "en";
}

export function GenerateForm({
  onGenerate,
  disabled,
  defaultTopic,
  defaultFocus,
  defaultLanguage,
}: GenerateFormProps) {
  const { data: recentTopics } = useRecentTopics();
  // Sourced from the server so the picker can never offer a language the
  // narrator has no voice for; the static list is just the pre-load fallback.
  const { data: languages } = useLessonLanguages();
  const languageChoices = languages ?? FALLBACK_LANGUAGES;

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectFile = (selected: File | undefined) => {
    if (!selected) return;
    if (selected.type !== "application/pdf") {
      toast.error("Only PDF files are supported.");
      return;
    }
    if (selected.size > MAX_PDF_MB * 1024 * 1024) {
      toast.error(`That PDF is too large — the limit is ${MAX_PDF_MB}MB.`);
      return;
    }
    setSourceFile(selected);
  };

  const clearFile = () => {
    setSourceFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GenerateValues>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      topic: defaultTopic ?? "",
      focus: defaultFocus ?? "",
      durationMin: 0,
      detailLevel: "standard",
      subtitles: true,
      language: toLessonLanguage(defaultLanguage),
      // English board by default: for the technical topics this gets used for,
      // an exam-matching English term is more useful written down than a
      // translated one, even when the explanation is in another language.
      boardLanguage: "en",
    },
  });

  const durationMin = watch("durationMin");
  const detailLevel = watch("detailLevel");
  const subtitles = watch("subtitles");
  const language = watch("language");
  const boardLanguage = watch("boardLanguage");
  const activeLanguage = languageChoices.find((choice) => choice.code === language);

  return (
    <Card>
      <CardHeader>
        <CardTitle>What do you want to learn?</CardTitle>
        <CardDescription>
          One topic in — a personalized board-explainer video, deck and narration out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((values) => onGenerate(values, sourceFile ?? undefined))}
          className="space-y-5"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="topic">Topic</Label>
            <Input
              id="topic"
              placeholder="e.g. How neural networks learn, The French Revolution, Photosynthesis…"
              disabled={disabled}
              {...register("topic")}
            />
            {errors.topic && <p className="text-xs text-red-400">{errors.topic.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="focus">
              Specific focus <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="focus"
              placeholder="Anything you especially want covered, or the reason you're learning it"
              disabled={disabled}
              {...register("focus")}
            />
            {errors.focus && <p className="text-xs text-red-400">{errors.focus.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Ground it in a PDF{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => handleSelectFile(event.target.files?.[0])}
            />
            {!sourceFile ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
              >
                <Upload className="h-4 w-4" /> Attach a PDF (textbook chapter, notes, article) — up to{" "}
                {MAX_PDF_MB}MB
              </button>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-5 w-5 shrink-0 text-primary" />
                  <span className="truncate text-sm font-medium">{sourceFile.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {(sourceFile.size / (1024 * 1024)).toFixed(1)}MB
                  </span>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={clearFile}
                  className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {sourceFile && (
              <p className="text-xs text-muted-foreground">
                The lesson will be grounded in this document's own content, plus anything useful
                SMART AI adds to fill the gaps.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-primary" /> Teach me in
            </Label>
            <div className="flex flex-wrap gap-2">
              {languageChoices.map((choice) => (
                <button
                  key={choice.code}
                  type="button"
                  disabled={disabled}
                  onClick={() => setValue("language", choice.code)}
                  title={choice.label}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm transition-colors disabled:opacity-50",
                    language === choice.code
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {choice.nativeLabel}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              The narration, subtitles, quiz and your AI tutor all switch to this language.
            </p>
          </div>

          {/* Only meaningful once the voice is not English — an English lesson
              with an English board has nothing to choose between. */}
          {language !== "en" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <PenLine className="h-4 w-4 text-primary" /> Write on the board in
              </Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { code: "en" as const, label: "English", hint: "keep terms exam-ready" },
                  { code: "same" as const, label: activeLanguage?.nativeLabel ?? "Same", hint: "fully translated" },
                ].map((choice) => (
                  <button
                    key={choice.code}
                    type="button"
                    disabled={disabled}
                    onClick={() => setValue("boardLanguage", choice.code)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm transition-colors disabled:opacity-50",
                      boardLanguage === choice.code
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    {choice.label}
                    <span className="ml-1.5 text-xs opacity-70">{choice.hint}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {boardLanguage === "en"
                  ? `Explained aloud in ${activeLanguage?.label ?? "your language"}, but written in English — the way a teacher speaks in your language and still writes the technical terms on the board.`
                  : "Everything on the board is translated too. Technical terms are still kept in English so they match your textbook."}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Lesson length</Label>
            <div className="flex flex-wrap gap-2">
              {DURATION_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => setValue("durationMin", choice.value)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm transition-colors disabled:opacity-50",
                    durationMin === choice.value
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Auto sizes the lesson to your attention span; a fixed length adjusts slides and
              narration to fit.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Explanation depth</Label>
            <div className="flex flex-wrap gap-2">
              {DETAIL_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => setValue("detailLevel", choice.value)}
                  title={choice.hint}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm transition-colors disabled:opacity-50",
                    detailLevel === choice.value
                      ? "border-secondary bg-secondary/15 text-secondary"
                      : "border-border text-muted-foreground hover:border-secondary/50 hover:text-foreground"
                  )}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              In-depth adds written notes to the board and walks through the “why” with examples.
            </p>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={() => setValue("subtitles", !subtitles)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-colors disabled:opacity-50",
              subtitles ? "border-accent/60 bg-accent/10" : "border-border hover:border-accent/40"
            )}
            role="switch"
            aria-checked={subtitles}
          >
            <span className="flex items-center gap-3">
              <Captions className={cn("h-5 w-5", subtitles ? "text-accent" : "text-muted-foreground")} />
              <span>
                <span className="block text-sm font-medium">Subtitles</span>
                <span className="block text-xs text-muted-foreground">
                  Captions in the player, an SRT download, and burned into the video
                </span>
              </span>
            </span>
            <span
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                subtitles ? "bg-accent" : "bg-muted"
              )}
              aria-hidden
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                  subtitles ? "left-[22px]" : "left-0.5"
                )}
              />
            </span>
          </button>

          {recentTopics && recentTopics.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Pick up where you left off:</p>
              <div className="flex flex-wrap gap-2">
                {recentTopics.slice(0, 6).map((recent) => (
                  <button
                    key={recent.topic}
                    type="button"
                    disabled={disabled}
                    onClick={() => setValue("topic", recent.topic, { shouldValidate: true })}
                    className="disabled:opacity-50"
                  >
                    <Badge variant="outline" className="cursor-pointer py-1 hover:border-primary hover:text-primary">
                      {recent.topic}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={disabled}>
            <Sparkles className="h-4 w-4" /> Generate my lesson
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
