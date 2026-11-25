"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BookOpen, Eye, Hand, Headphones, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useDiscoveryChallenge, useSubmitDiscovery } from "@/hooks/useQuestionnaire";
import { useSpeech } from "@/hooks/useSpeech";
import { toErrorMessage } from "@/services/api";
import { cn } from "@/lib/utils";
import { stepSlide } from "@/lib/motion";
import type { LearningProfileData } from "@/lib/types";
import { ProfileReveal } from "./ProfileReveal";

/**
 * Learning Discovery — six short activities that replace the old survey.
 * Instead of asking learners to describe themselves, it watches what they do:
 * which format they settle on, how fast they read, whether they ask for more,
 * whether their confidence matches their answers, and whether an idea from the
 * first minute is still there at the end. Scoring happens on the server
 * (packages/core/src/prompts/discovery.ts).
 */

type Format = "visual" | "auditory" | "reading" | "kinesthetic";

const MOON_TEXT =
  "The Moon makes no light of its own. The Sun always lights up one half of it. As the Moon circles Earth each month, we see different amounts of that sunlit half: none of it at new moon, all of it at full moon. Earth's shadow has nothing to do with it.";

// Keep in sync with READING_PASSAGE_WORDS in packages/core/src/prompts/discovery.ts.
const PASSAGE =
  "Most of what you learn today will be gone by next week, and that is normal. Memory fades fastest in the first day, then more slowly. The fix is not to study longer in one sitting. It is to come back to the idea just as you are about to forget it. Each return makes the memory last longer than the time before, so the gaps can grow: a day, then three days, then a week. Ten minutes spread across a month beats an hour spent in one evening, because forgetting a little and recovering it is what makes memory strong.";

const PASSAGE_MORE =
  "This is called the spacing effect. It works because pulling a fading memory back takes effort, and that effort is the signal your brain uses to decide what is worth keeping. Rereading feels productive but skips the effort; testing yourself does not.";

const FORMATS: { id: Format; label: string; icon: typeof Eye }[] = [
  { id: "visual", label: "See it", icon: Eye },
  { id: "auditory", label: "Hear it", icon: Headphones },
  { id: "reading", label: "Read it", icon: BookOpen },
  { id: "kinesthetic", label: "Try it", icon: Hand },
];

const EXPLANATIONS = [
  { id: "definition", text: "Compound interest is interest calculated on the original amount plus all the interest already earned." },
  { id: "example", text: "Put in 1,000 at 10% a year. Year one earns 100. Year two earns 110, because that 100 is earning too. Year three: 121." },
  { id: "analogy", text: "It is a snowball rolling downhill: the bigger it gets, the more snow it picks up on every turn." },
] as const;

const MEMORY = [
  { id: "story", text: "A tiny story: a Red fox Offers You Green Berries In a Violet bowl." },
  { id: "repetition", text: "Say it five times over: red, orange, yellow, green, blue, indigo, violet." },
  { id: "association", text: "Link each to a thing: red apple, orange fruit, yellow sun, green leaf, blue sky." },
  { id: "structure", text: "Sort it: warm colours (red, orange, yellow), the middle (green), cool colours (blue, indigo, violet)." },
] as const;

const TEACHERS = [
  { id: "friendly", name: "Maya", text: "Okay, picture this: you drop your phone. Ouch! But why does it fall down and never float away? Let's figure it out together." },
  { id: "professional", name: "Mr. Rao", text: "Gravity is the force that pulls objects toward each other. Here is what it does and where you will use it." },
  { id: "academic", name: "Dr. Iyer", text: "Gravitation is a fundamental interaction: every mass attracts every other mass, with a force proportional to the product of their masses." },
] as const;

const GOALS = [
  { id: "curiosity", label: "I'm curious and want to understand things" },
  { id: "exam", label: "I have an exam to pass" },
  { id: "career", label: "I need it for my work or career" },
  { id: "hobby", label: "It's for fun, in my own time" },
] as const;

const LEVELS = [
  { id: "beginner", label: "Start from zero" },
  { id: "intermediate", label: "I usually know the basics" },
  { id: "advanced", label: "Skip ahead and push me" },
] as const;

const RECALL_OPTIONS = [
  "Earth's shadow covering part of the Moon",
  "How much of the Moon's sunlit half we can see",
  "Clouds in Earth's atmosphere",
  "The Moon spinning faster and slower",
];

/** The Moon as seen from Earth. phase: 0 = new, 0.5 = full, 1 = new again. */
function MoonDisc({ phase, size = 56 }: { phase: number; size?: number }) {
  const r = 24;
  const k = Math.cos(2 * Math.PI * phase);
  const waxing = phase <= 0.5;
  const lit = "#F8FAFC";
  const dark = "#1E293B";
  return (
    <svg width={size} height={size} viewBox="-26 -26 52 52" aria-hidden>
      <circle r={r} fill={dark} />
      <path d={`M0 ${-r} A${r} ${r} 0 0 ${waxing ? 1 : 0} 0 ${r} Z`} fill={lit} />
      <ellipse rx={Math.abs(k) * r} ry={r} fill={k > 0 ? dark : lit} />
      <circle r={r} fill="none" stroke="#475569" strokeWidth="1" />
    </svg>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border p-4 text-left text-sm transition-[border-color,background-color,box-shadow] duration-200 sm:text-base",
        selected
          ? "border-foreground bg-foreground/[0.05] shadow-[inset_3px_0_0_0_hsl(var(--mark))]"
          : "border-input bg-card hover:border-foreground"
      )}
    >
      {children}
    </button>
  );
}

const STEP_TITLES = ["One idea, four ways", "Read at your own speed", "Which one would you keep?", "Pick your teacher", "Quick challenge", "Last two"];

export function DiscoveryLab() {
  const { data: challenge } = useDiscoveryChallenge();
  const submitMutation = useSubmitDiscovery();
  const { speak, cancel, supported: speechSupported } = useSpeech();

  const [step, setStep] = useState(0);
  const [result, setResult] = useState<LearningProfileData | null>(null);

  // Step 0
  const [openFormat, setOpenFormat] = useState<Format>("visual");
  const [explored, setExplored] = useState<Format[]>(["visual"]);
  const [clicked, setClicked] = useState<Format | null>(null);
  const [orbit, setOrbit] = useState(0.15);
  // Step 1
  const readStart = useRef(0);
  const [readingMs, setReadingMs] = useState<number | null>(null);
  const [wantedMore, setWantedMore] = useState<boolean | null>(null);
  // Step 2
  const [explanationPick, setExplanationPick] = useState<string | null>(null);
  const [memoryPick, setMemoryPick] = useState<string | null>(null);
  // Step 3
  const [teacherPick, setTeacherPick] = useState<string | null>(null);
  // Step 4
  const [answers, setAnswers] = useState<Record<number, { answer: number; sure?: boolean }>>({});
  const [startLevel, setStartLevel] = useState<string | null>(null);
  // Step 5
  const [goal, setGoal] = useState<string | null>(null);
  const [recall, setRecall] = useState<number | null>(null);

  useEffect(() => {
    if (step === 1) readStart.current = performance.now();
    return cancel;
  }, [step, cancel]);

  if (result) return <ProfileReveal profile={result} />;

  const open = (format: Format) => {
    cancel();
    setOpenFormat(format);
    setExplored((prev) => (prev.includes(format) ? prev : [...prev, format]));
  };

  const challengeDone =
    Boolean(challenge) && challenge!.every((_, i) => answers[i] !== undefined && answers[i].sure !== undefined);

  const canContinue = [
    clicked !== null,
    readingMs !== null && wantedMore !== null,
    explanationPick !== null && memoryPick !== null,
    teacherPick !== null,
    challengeDone && startLevel !== null,
    goal !== null && recall !== null,
  ][step];

  const finish = async () => {
    try {
      const profile = await submitMutation.mutateAsync({
        clickedFormat: clicked,
        exploredFormats: explored,
        readingMs: Math.round(readingMs ?? 0),
        wantedMore,
        explanationPick,
        memoryPick,
        teacherPick,
        goal,
        startLevel,
        challenge: (challenge ?? []).map((_, i) => ({ answer: answers[i].answer, sure: Boolean(answers[i].sure) })),
        recallAnswer: recall,
      });
      setResult(profile);
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  const total = STEP_TITLES.length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 space-y-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Activity {step + 1} of {total}
          </span>
          <span className="tabular-nums">{Math.round((step / total) * 100)}% done</span>
        </div>
        <Progress value={(step / total) * 100} />
      </div>

      <AnimatePresence mode="wait" custom={1}>
        <motion.div
          key={step}
          custom={1}
          variants={stepSlide}
          initial="enter"
          animate="center"
          exit="exit"
          className="rounded-lg border-2 border-foreground bg-card p-5 sm:p-8"
        >
          <Badge variant="accent" className="mb-3">
            {STEP_TITLES[step]}
          </Badge>

          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold sm:text-2xl">Why does the Moon change shape?</h2>
              <p className="text-sm text-muted-foreground">Here is the same answer four ways. Look around, then tell us which one made it click.</p>
              <div className="grid grid-cols-4 gap-2">
                {FORMATS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => open(id)}
                    className={cn(
                      "flex min-h-11 flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                      openFormat === id ? "border-foreground bg-foreground text-background" : "border-input text-muted-foreground hover:border-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex min-h-[190px] items-center justify-center rounded-lg bg-[#0A1330] p-5 text-[#EEF2FB]">
                {openFormat === "visual" && (
                  <div className="flex flex-wrap items-end justify-center gap-3">
                    {[0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((p) => (
                      <MoonDisc key={p} phase={p} size={48} />
                    ))}
                    <p className="w-full text-center text-xs text-[#A8A092]">One month, left to right. The Sun always lights half; we just see more or less of that half.</p>
                  </div>
                )}
                {openFormat === "auditory" && (
                  <div className="space-y-3 text-center">
                    <Button variant="secondary" onClick={() => speak(MOON_TEXT)} disabled={!speechSupported}>
                      <Volume2 className="h-4 w-4" /> Play the explanation
                    </Button>
                    <p className="text-xs text-[#A8A092]">{speechSupported ? "About 15 seconds. Close your eyes if it helps." : "Your browser has no speech voice. Try another format."}</p>
                  </div>
                )}
                {openFormat === "reading" && <p className="max-w-md text-sm leading-relaxed">{MOON_TEXT}</p>}
                {openFormat === "kinesthetic" && (
                  <div className="w-full space-y-3">
                    <div className="flex items-center justify-center gap-6">
                      <svg width="210" height="130" viewBox="-105 -65 210 130" aria-hidden>
                        <circle cx="-92" cy="0" r="10" fill="#FBBF24" />
                        <text x="-92" y="26" textAnchor="middle" fontSize="9" fill="#94A3B8">Sun</text>
                        <circle r="48" fill="none" stroke="#334155" strokeDasharray="3 4" />
                        <circle r="9" fill="#38BDF8" />
                        <circle cx={-48 * Math.cos(2 * Math.PI * orbit)} cy={-48 * Math.sin(2 * Math.PI * orbit)} r="6" fill="#F8FAFC" />
                      </svg>
                      <div className="text-center">
                        <MoonDisc phase={orbit} size={72} />
                        <p className="mt-1 text-xs text-[#A8A092]">What you see</p>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.005}
                      value={orbit}
                      onChange={(e) => setOrbit(Number(e.target.value))}
                      aria-label="Move the Moon around Earth"
                      className="w-full accent-[#F97316]"
                    />
                    <p className="text-center text-xs text-[#A8A092]">Drag to move the Moon around Earth and watch its shape change.</p>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Which one made it click?</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {FORMATS.map(({ id, label }) => (
                    <Choice key={id} selected={clicked === id} onClick={() => setClicked(id)}>
                      {label}
                    </Choice>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold sm:text-2xl">Read this the way you normally would</h2>
              <p className="rounded-lg bg-muted/50 p-5 text-sm leading-relaxed sm:text-base">{PASSAGE}</p>
              {readingMs === null ? (
                <Button onClick={() => setReadingMs(performance.now() - readStart.current)}>I&apos;ve read it</Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Want the reason it works, or is that enough?</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Choice selected={wantedMore === true} onClick={() => setWantedMore(true)}>
                      Tell me why it works
                    </Choice>
                    <Choice selected={wantedMore === false} onClick={() => setWantedMore(false)}>
                      That&apos;s enough for me
                    </Choice>
                  </div>
                  {wantedMore && <p className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed">{PASSAGE_MORE}</p>}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h2 className="text-xl font-semibold sm:text-2xl">Three ways to explain compound interest</h2>
                <p className="text-sm text-muted-foreground">Which one would you want in your notes?</p>
                {EXPLANATIONS.map((e) => (
                  <Choice key={e.id} selected={explanationPick === e.id} onClick={() => setExplanationPick(e.id)}>
                    {e.text}
                  </Choice>
                ))}
              </div>
              <div className="space-y-3">
                <h3 className="text-base font-semibold">You have to remember the rainbow&apos;s colours in order</h3>
                <p className="text-sm text-muted-foreground">Which trick would actually work for you?</p>
                {MEMORY.map((m) => (
                  <Choice key={m.id} selected={memoryPick === m.id} onClick={() => setMemoryPick(m.id)}>
                    {m.text}
                  </Choice>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold sm:text-2xl">Three teachers start the same lesson</h2>
              <p className="text-sm text-muted-foreground">Whose class would you stay in?</p>
              {TEACHERS.map((t) => (
                <Choice key={t.id} selected={teacherPick === t.id} onClick={() => setTeacherPick(t.id)}>
                  <span className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-semibold">{t.name}</span>
                    {speechSupported && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Hear ${t.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          speak(t.text);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            speak(t.text);
                          }
                        }}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:border-foreground hover:text-foreground"
                      >
                        <Volume2 className="h-4 w-4" />
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">&ldquo;{t.text}&rdquo;</span>
                </Choice>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold sm:text-2xl">Three quick puzzles</h2>
              <p className="text-sm text-muted-foreground">Answer each one, then say whether you were sure or guessing. Guessing is fine.</p>
              {(challenge ?? []).map((q, i) => (
                <div key={q.id} className="space-y-2">
                  <p className="text-sm font-medium sm:text-base">
                    {i + 1}. {q.text}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {q.options.map((option, optionIndex) => (
                      <Choice
                        key={option}
                        selected={answers[i]?.answer === optionIndex}
                        onClick={() => setAnswers((prev) => ({ ...prev, [i]: { ...prev[i], answer: optionIndex } }))}
                      >
                        {option}
                      </Choice>
                    ))}
                  </div>
                  {answers[i] !== undefined && (
                    <div className="flex gap-2">
                      {[
                        [true, "I'm sure"],
                        [false, "I guessed"],
                      ].map(([value, label]) => (
                        <button
                          key={String(label)}
                          type="button"
                          aria-pressed={answers[i].sure === value}
                          onClick={() => setAnswers((prev) => ({ ...prev, [i]: { ...prev[i], sure: value as boolean } }))}
                          className={cn(
                            "min-h-11 rounded-md border px-4 text-xs font-medium transition-colors",
                            answers[i].sure === value ? "border-foreground bg-foreground text-background" : "border-input text-muted-foreground hover:border-foreground hover:text-foreground"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="space-y-2">
                <p className="text-sm font-medium sm:text-base">When you start a new topic, where should we begin?</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {LEVELS.map((l) => (
                    <Choice key={l.id} selected={startLevel === l.id} onClick={() => setStartLevel(l.id)}>
                      {l.label}
                    </Choice>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h2 className="text-xl font-semibold sm:text-2xl">Why are you learning right now?</h2>
                {GOALS.map((g) => (
                  <Choice key={g.id} selected={goal === g.id} onClick={() => setGoal(g.id)}>
                    {g.label}
                  </Choice>
                ))}
              </div>
              <div className="space-y-3">
                <h3 className="text-base font-semibold">One from earlier: what causes the Moon&apos;s phases?</h3>
                <p className="text-sm text-muted-foreground">No going back. This tells us how often to bring ideas back for you.</p>
                {RECALL_OPTIONS.map((option, i) => (
                  <Choice key={option} selected={recall === i} onClick={() => setRecall(i)}>
                    {option}
                  </Choice>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex justify-end">
        {step < total - 1 ? (
          <Button variant="secondary" disabled={!canContinue} onClick={() => setStep(step + 1)}>
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="gradient" disabled={!canContinue} loading={submitMutation.isPending} onClick={finish}>
            Build my learning profile
          </Button>
        )}
      </div>
    </div>
  );
}
