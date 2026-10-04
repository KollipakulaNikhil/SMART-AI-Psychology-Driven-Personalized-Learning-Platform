"use client";

import { useMemo, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useTransform } from "framer-motion";
import {
  CalendarClock,
  Crown,
  Flame,
  Hourglass,
  RotateCcw,
  Shield,
  Star,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { BOSS_MULTIPLIER, STAGE_SIZE, TIME_WARP_SEC } from "./engine";
import type { QuizGame } from "./useQuizGame";

export type GameTone = "dark" | "light";

export interface GameMeta {
  id: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
  tone: GameTone;
  /** Solid colour behind the scene and the stacked (mobile) question card. */
  sceneBg: string;
  /** What a correct answer earns in this world — "Lanterns", "Stars", "Blooms". */
  unit: string;
  cta: string;
  again: string;
  intro: (total: number, roundSec: number) => string;
  /** Titles for a perfect run, a pass (≥60%), and a miss. */
  ranks: [string, string, string];
  Scene: ComponentType<{ game: QuizGame }>;
  Preview: ComponentType;
}

const TONES: Record<
  GameTone,
  {
    card: string;
    title: string;
    optionIdle: string;
    optionPicked: string;
    optionCorrect: string;
    optionWrong: string;
    optionDim: string;
    keycap: string;
    muted: string;
    faint: string;
    wrongLabel: string;
    backdrop: string;
    panel: string;
    stat: string;
    statLabel: string;
    outlineBtn: string;
  }
> = {
  dark: {
    card: "border-white/12 bg-white/[0.08] text-white",
    title: "text-white",
    optionIdle: "border-white/15 bg-white/[0.06] hover:border-indigo-300/60 hover:bg-white/[0.12]",
    optionPicked: "border-indigo-300 bg-indigo-400/30",
    optionCorrect: "border-emerald-400 bg-emerald-400/25 text-emerald-50",
    optionWrong: "border-rose-400 bg-rose-500/25 text-rose-50",
    optionDim: "border-white/10 opacity-40",
    keycap: "bg-white/15",
    muted: "text-white/75",
    faint: "text-white/50",
    wrongLabel: "text-rose-200",
    backdrop: "bg-black/35",
    panel: "border-white/15 bg-white/[0.08] text-white",
    stat: "bg-white/10",
    statLabel: "text-white/60",
    outlineBtn: "border-white/20 bg-white/10 text-white hover:bg-white/20",
  },
  // Explicit slate colours rather than theme tokens: this world is light even
  // when the app is in dark mode, so the text must not follow the theme.
  light: {
    card: "border-slate-900/10 bg-white/85 text-slate-900",
    title: "text-slate-900",
    optionIdle: "border-slate-200 bg-white text-slate-800 hover:border-indigo-400 hover:bg-indigo-50",
    optionPicked: "border-indigo-500 bg-indigo-100 text-slate-900",
    optionCorrect: "border-emerald-500 bg-emerald-100 text-emerald-900",
    optionWrong: "border-rose-500 bg-rose-100 text-rose-900",
    optionDim: "border-slate-200 text-slate-500 opacity-50",
    keycap: "bg-slate-900/[0.08] text-slate-700",
    muted: "text-slate-600",
    faint: "text-slate-500",
    wrongLabel: "text-rose-600",
    backdrop: "bg-white/30",
    panel: "border-slate-900/10 bg-white/85 text-slate-900",
    stat: "bg-slate-900/[0.05]",
    statLabel: "text-slate-500",
    outlineBtn: "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
  },
};

/**
 * Everything around a scene: HUD (progress, score, combo, mute, timer ring),
 * the intro and finish overlays, and the question card. Scenes plug in as
 * children and draw the world.
 */
export function GameShell({ game, meta, children }: { game: QuizGame; meta: GameMeta; children: ReactNode }) {
  const t = TONES[meta.tone];
  const Icon = meta.icon;
  const {
    phase,
    total,
    index,
    score,
    combo,
    floaters,
    muted,
    secs,
    question,
    current,
    pending,
    inRound,
    showQuestion,
  } = game;
  const { lifelines, shields, eliminated, boss, stage, stages } = game;
  const lastResult = game.results[game.results.length - 1];
  const playing = phase !== "intro" && phase !== "summit";

  const ringRemaining = useTransform(game.timeLeft, (v) => Math.min(1, v / game.roundSec));
  const ringColor = useTransform(
    game.timeLeft,
    [0, game.roundSec * 0.25, game.roundSec],
    ["#f87171", "#fbbf24", "#a5b4fc"],
    { clamp: true },
  );

  const rank =
    game.correctCount === total ? meta.ranks[0] : game.correctCount / total >= 0.6 ? meta.ranks[1] : meta.ranks[2];

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl shadow-float ring-1 ring-black/10">
        <div className="relative aspect-[1000/620] w-full select-none" style={{ backgroundColor: meta.sceneBg }}>
          {children}

          {/* ── HUD ───────────────────────────────────────────────────────── */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur">
                {phase === "summit" ? "Finished" : `${Math.min(index + 1, total)} / ${total}`}
              </span>
              {playing && stages > 1 && (
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur",
                    boss ? "bg-rose-500/80 text-white" : "bg-black/35 text-white/90",
                  )}
                >
                  {boss ? <Crown className="h-3.5 w-3.5" /> : null}
                  {boss ? "Boss" : `Stage ${stage + 1}/${stages}`}
                </span>
              )}
              {shields > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-sky-500/70 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
                  {Array.from({ length: shields }, (_, i) => (
                    <Shield key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </span>
              )}
              <span className="relative rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-amber-200 backdrop-blur">
                <motion.span key={score} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="inline-block">
                  {score}
                </motion.span>{" "}
                pts
                {floaters.map((f) => (
                  <span
                    key={f.id}
                    className="absolute left-1/2 top-0 -translate-x-1/2 animate-float-up whitespace-nowrap font-bold text-amber-300"
                  >
                    {f.text}
                  </span>
                ))}
              </span>
              <AnimatePresence>
                {combo >= 2 && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    className={cn(
                      "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold backdrop-blur",
                      combo >= 5 ? "bg-orange-500/80 text-white" : "bg-amber-400/80 text-amber-950",
                    )}
                  >
                    <Flame className="h-3.5 w-3.5" /> {combo}× combo
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => game.setMuted((m) => !m)}
                className="rounded-full bg-black/35 p-2 text-white/80 backdrop-blur transition hover:bg-black/50"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <div
                className={cn(
                  "relative grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur transition-opacity",
                  inRound ? "opacity-100" : "opacity-0",
                )}
              >
                <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full -rotate-90">
                  <circle cx={20} cy={20} r={17} fill="none" stroke="#ffffff" strokeOpacity={0.15} strokeWidth={3} />
                  <motion.circle
                    cx={20}
                    cy={20}
                    r={17}
                    fill="none"
                    strokeWidth={3}
                    strokeLinecap="round"
                    style={{ pathLength: ringRemaining, stroke: ringColor }}
                  />
                </svg>
                <span className="text-xs font-bold tabular-nums text-white">{secs}</span>
              </div>
            </div>
          </div>

          {/* ── Feedback fx ─────────────────────────────────────────────────── */}
          {lastResult && phase !== "summit" && (
            <>
              {lastResult.correct && <Burst key={`b${game.runId}-${game.results.length}`} big={lastResult.boss} />}
              {!lastResult.correct && !lastResult.shielded && (
                <motion.div
                  key={`d${game.runId}-${game.results.length}`}
                  initial={{ opacity: 0.55 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.7 }}
                  className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_30px_rgba(244,63,94,0.85)]"
                />
              )}
            </>
          )}
          {playing && (boss || index % STAGE_SIZE === 0) && (
            <motion.div
              key={`banner${game.runId}-${index}`}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1.05, 1, 1.1] }}
              transition={{ duration: 1.8, times: [0, 0.2, 0.75, 1] }}
              className="pointer-events-none absolute inset-x-0 top-[34%] z-10 flex justify-center"
            >
              <div
                className={cn(
                  "rounded-2xl px-6 py-3 text-center shadow-float backdrop-blur-md",
                  boss ? "bg-rose-600/85 text-white" : "bg-black/55 text-white",
                )}
              >
                <p className="font-display text-2xl font-extrabold tracking-wide sm:text-3xl">
                  {boss ? "BOSS ROUND" : `STAGE ${stage + 1}`}
                </p>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
                  {boss ? `${BOSS_MULTIPLIER}× points` : `${stages} stages · ${total} questions`}
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Intro / finish overlays ─────────────────────────────────────── */}
          {phase === "summit" && <Confetti />}
          <AnimatePresence>
            {phase === "intro" && (
              <Overlay key="intro" tone={meta.tone}>
                <Icon className="mx-auto h-10 w-10 text-amber-400" />
                <h2 className={cn("mt-3 font-display text-2xl font-bold sm:text-3xl", t.title)}>{meta.name}</h2>
                <p className={cn("mx-auto mt-2 max-w-md text-sm", t.muted)}>{meta.intro(total, game.roundSec)}</p>
                <Button variant="gradient" size="lg" className="mt-6" onClick={game.start}>
                  <Zap className="h-4 w-4" /> {meta.cta}
                </Button>
                <p className={cn("mt-3 text-xs", t.faint)}>Keys 1–4 answer · F 50/50 · T time warp · Enter continues</p>
              </Overlay>
            )}
            {phase === "summit" && (
              <Overlay key="summit" tone={meta.tone}>
                <p className="eyebrow justify-center text-amber-500">{rank}</p>
                <h2 className={cn("mt-2 font-display text-3xl font-bold sm:text-4xl", t.title)}>{score} pts</h2>
                {game.newBest ? (
                  <p className="mt-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-amber-500">
                    <Trophy className="h-4 w-4" /> New personal best!
                  </p>
                ) : game.best > 0 ? (
                  <p className={cn("mt-1 text-xs", t.faint)}>Personal best: {game.best} pts</p>
                ) : null}
                {game.stageStars.length > 0 && (
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {game.stageStars.map((n, i) => (
                      <span key={i} className={cn("flex items-center gap-0.5 rounded-full px-2.5 py-1", t.stat)}>
                        {[0, 1, 2].map((k) => (
                          <Star
                            key={k}
                            className={cn(
                              "h-3.5 w-3.5",
                              k < n ? "fill-amber-400 text-amber-400" : "text-current opacity-25",
                            )}
                          />
                        ))}
                      </span>
                    ))}
                  </div>
                )}
                <div className={cn("mx-auto mt-4 grid max-w-sm grid-cols-3 gap-2", t.title)}>
                  <Stat label={meta.unit} value={`${game.correctCount}/${total}`} cls={t.stat} labelCls={t.statLabel} />
                  <Stat
                    label="Accuracy"
                    value={`${Math.round((game.correctCount / total) * 100)}%`}
                    cls={t.stat}
                    labelCls={t.statLabel}
                  />
                  <Stat label="Best combo" value={`${game.bestCombo}×`} cls={t.stat} labelCls={t.statLabel} />
                </div>
                <div className={cn("mx-auto mt-4 min-h-[2.5rem] max-w-md text-sm", t.muted)}>
                  {game.attempt ? (
                    <p className="flex items-center justify-center gap-2">
                      <CalendarClock className="h-4 w-4 text-amber-500" />
                      {game.attempt.passed
                        ? `Smart Review returns on ${formatDate(game.attempt.nextReviewAt)}`
                        : "Below 60% — this comes back tomorrow"}
                      {game.attempt.streak > 1 && ` · 🔥 ${game.attempt.streak}-day streak`}
                    </p>
                  ) : (
                    <p className={t.faint}>Recording your run…</p>
                  )}
                </div>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button variant="gradient" onClick={game.start}>
                    <RotateCcw className="h-4 w-4" /> {meta.again}
                  </Button>
                  <Link
                    href={`/dashboard/lesson/${game.lesson.id}`}
                    className={cn(buttonVariants({ variant: "outline" }), t.outlineBtn)}
                  >
                    Back to lesson
                  </Link>
                </div>
              </Overlay>
            )}
          </AnimatePresence>
        </div>

        {/* ── Question card: overlays the scene on wide screens, stacks below on phones */}
        <AnimatePresence mode="wait">
          {showQuestion && question && (
            <motion.div
              key={`${game.runId}-${index}`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              style={{ backgroundColor: meta.sceneBg }}
              className={cn(
                "p-4 sm:p-5 md:!bg-transparent",
                "md:absolute md:bottom-5 md:right-5 md:w-[min(560px,58%)] md:rounded-2xl md:border md:shadow-float md:backdrop-blur-xl",
                t.card,
                meta.tone === "dark" ? "md:!bg-white/[0.08]" : "md:!bg-white/85",
              )}
            >
              {boss && (
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-rose-400">
                  <Crown className="h-3.5 w-3.5" /> Boss round · {BOSS_MULTIPLIER}× points
                </p>
              )}
              <p className="font-display text-base font-semibold leading-snug sm:text-lg">{question.question}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {question.options.map((option, i) => {
                  const isPicked = current ? current.answer === i : pending === i;
                  const isCorrect = current?.correctIndex === i;
                  const crossed = eliminated.includes(i) && !current;
                  return (
                    <motion.button
                      key={i}
                      type="button"
                      disabled={phase !== "question" || crossed}
                      onClick={() => void game.submitAnswer(i)}
                      whileTap={phase === "question" ? { scale: 0.97 } : undefined}
                      animate={current && isPicked && !current.correct ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                      transition={{ duration: 0.35 }}
                      className={cn(
                        "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-default",
                        !current && !isPicked && !crossed && t.optionIdle,
                        crossed && cn(t.optionDim, "line-through"),
                        !current && isPicked && cn(t.optionPicked, "animate-pulse-soft"),
                        current && isCorrect && t.optionCorrect,
                        current && isPicked && !isCorrect && t.optionWrong,
                        current && !isPicked && !isCorrect && t.optionDim,
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md text-[11px] font-bold",
                          t.keycap,
                        )}
                      >
                        {i + 1}
                      </span>
                      <span>{option}</span>
                    </motion.button>
                  );
                })}
              </div>

              {phase === "question" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <LifelineButton
                    label="50/50"
                    keycap="F"
                    count={lifelines.fifty}
                    disabled={lifelines.fifty < 1 || eliminated.length > 0 || game.hinting}
                    onClick={() => void game.castFifty()}
                    cls={t.outlineBtn}
                    keyCls={t.keycap}
                  />
                  <LifelineButton
                    icon={<Hourglass className="h-3.5 w-3.5" />}
                    label={`+${TIME_WARP_SEC}s`}
                    keycap="T"
                    count={lifelines.warp}
                    disabled={lifelines.warp < 1}
                    onClick={game.castWarp}
                    cls={t.outlineBtn}
                    keyCls={t.keycap}
                  />
                  <span className={cn("ml-auto text-[11px]", t.faint)}>
                    {shields > 0 ? `${shields} shield${shields > 1 ? "s" : ""} ready` : "4 in a row earns a shield"}
                  </span>
                </div>
              )}

              <AnimatePresence>
                {current && !current.correct && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className={cn("text-sm", t.muted)}>
                        <span className={cn("font-semibold", t.wrongLabel)}>
                          {current.shielded
                            ? "Shield absorbed it — "
                            : current.answer === null
                              ? "Out of time — "
                              : "Not quite — "}
                        </span>
                        {current.explanation}
                      </p>
                      <Button size="sm" variant="gradient" className="shrink-0" onClick={() => void game.next()}>
                        Continue
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {phase === "summit" && <ReviewPanel game={game} meta={meta} />}
    </div>
  );
}

function ReviewPanel({ game, meta }: { game: QuizGame; meta: GameMeta }) {
  const missed = game.results.map((r, i) => ({ r, q: game.questions[i], i })).filter(({ r }) => !r.correct);
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <h3 className="font-display text-lg font-semibold">
        {missed.length === 0
          ? "Flawless run — nothing to review"
          : `Review ${missed.length} missed question${missed.length > 1 ? "s" : ""}`}
      </h3>
      {missed.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          You cleared every {meta.unit.toLowerCase().replace(/s$/, "")} in this lesson. Try beating your score.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {missed.map(({ r, q, i }) => (
            <li key={i} className="rounded-2xl border border-border bg-background/60 p-4 text-sm">
              <p className="font-medium">
                <span className="mr-1.5 text-muted-foreground">Q{i + 1}.</span>
                {q.question}
              </p>
              <p className="mt-2 text-rose-600 dark:text-rose-400">
                {r.answer === null ? "You ran out of time" : `Your answer: ${q.options[r.answer]}`}
              </p>
              <p className="text-emerald-600 dark:text-emerald-400">Correct: {q.options[r.correctIndex]}</p>
              {r.explanation && <p className="mt-1.5 text-muted-foreground">{r.explanation}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LifelineButton({
  label,
  keycap,
  count,
  disabled,
  onClick,
  cls,
  keyCls,
  icon,
}: {
  label: string;
  keycap: string;
  count: number;
  disabled: boolean;
  onClick: () => void;
  cls: string;
  keyCls: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
        cls,
      )}
    >
      {icon}
      {label}
      <span className="rounded bg-amber-400/90 px-1.5 text-[11px] font-bold text-amber-950">×{count}</span>
      <span className={cn("hidden rounded px-1 text-[10px] sm:inline", keyCls)}>{keycap}</span>
    </button>
  );
}

/** A radial pop of sparks from the middle of the scene on a correct answer. */
function Burst({ big }: { big: boolean }) {
  const sparks = useMemo(() => {
    const n = big ? 34 : 18;
    return Array.from({ length: n }, (_, i) => {
      const angle = (i / n) * Math.PI * 2 + (i % 3) * 0.2;
      const dist = (big ? 190 : 120) + (i % 5) * 18;
      return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist * 0.7,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 5 + (i % 3) * 2,
      };
    });
  }, [big]);
  return (
    <div className="pointer-events-none absolute left-1/2 top-[42%] z-10 h-0 w-0" aria-hidden>
      {sparks.map((p, i) => (
        <motion.span
          key={i}
          className="absolute block rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 10px ${p.color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y + 30, opacity: 0, scale: 0.3 }}
          transition={{ duration: big ? 1.1 : 0.8, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

function Overlay({ children, tone }: { children: ReactNode; tone: GameTone }) {
  const t = TONES[tone];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("absolute inset-0 flex overflow-y-auto p-4 backdrop-blur-[2px]", t.backdrop)}
    >
      <motion.div
        initial={{ y: 16, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className={cn(
          "relative m-auto w-full max-w-lg overflow-hidden rounded-2xl border p-6 text-center shadow-float backdrop-blur-xl sm:p-8",
          t.panel,
        )}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, value, cls, labelCls }: { label: string; value: string; cls: string; labelCls: string }) {
  return (
    <div className={cn("rounded-xl px-2 py-2", cls)}>
      <p className="font-display text-lg font-bold">{value}</p>
      <p className={cn("text-[11px] uppercase tracking-wider", labelCls)}>{label}</p>
    </div>
  );
}

const CONFETTI_COLORS = ["#fde68a", "#f59e0b", "#a5b4fc", "#6366f1", "#67e8f9", "#f9a8d4"];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 12) * 0.08,
        duration: 2.2 + ((i * 7) % 10) / 10,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        w: 6 + (i % 3) * 2,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute -top-2 block animate-confetti rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.w * 1.6,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
