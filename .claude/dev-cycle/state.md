# Dev Cycle State

status: inactive
started_at: 2026-08-16
last_round_at: 2026-08-17 (round 11 fully closed; round 12 interrupted mid-review, see Cycle Log)
round_count: 11

## Research Summary

**SMART AI** — psychology-driven personalized AI learning platform. Monorepo: `backend/` (Express 4 + TS + Mongoose 8, port 5000, `tsx watch` dev / `tsc` build) and `frontend/` (Next.js 15 App Router + React 19 + Tailwind v3 + React Query v5 + Firebase client auth, port 3000). Root `npm run dev` runs both via `concurrently`; `npm run typecheck`/`build` run both sides. No test framework in either package (confirmed — verification is typecheck + targeted manual/scripted checks).

**Core USP / chain:** 20-question quiz (`backend/src/prompts/questions.ts`, weighted votes) → traits (`profileBuilder.ts` argmax) → `deriveGenerationParams()` knobs (slide count, bullets/slide, script words, TTS speed, image emphasis, quiz count) → drives the AI content prompt (`promptEngine.ts`), PPTX layout, SVG slide/board renderer, TTS voice settings, video length. One topic renders differently per learner.

**AI provider architecture:** content generation is provider-agnostic. `promptEngine.ts` exports `runContentGeneration`/`runStructuredGeneration` (ask → zod-validate → one repair round); `gemini.service.ts` / `groq.service.ts` wrap their own calls; `aiContent.service.ts` orchestrates with Gemini-first, Groq-fallback, plus a 5-min circuit breaker per provider on quota failure. `config/env.ts` requires at least one of `GEMINI_API_KEY`/`GROQ_API_KEY`. Groq 70b (`llama-3.3-70b-versatile`) = 12k TPM; 8b fallback is weaker (smaller TPM, can't reliably write Telugu) — translation uses `callGroqStrong()` (70b-only, no 8b fallback) to avoid gibberish.

**Feature surface (built, per project memory — verify current code before assuming unchanged):** multi-select questionnaire; duration/detail-level/subtitles generation options; Learning Paths + Smart Review (SM-2 spaced repetition, study streaks, course planner, quiz grading server-side); AI Tutor chat grounded in slide scripts; async fire-and-return video pipeline (Wav2Lip avatar optional, gated by `AVATAR_ENABLED`); free Edge-TTS fallback (`msedge-tts`, no key needed) layered under ElevenLabs; multilingual lessons (English/Hindi/Telugu/Tamil/Spanish) with separate spoken-vs-written (board) language selection; word-level-synced chalkboard reveal (`boardTimeline.service.ts`); deck redesigned as a study handout (concept→notes→example pages + practice/quiz/answer-key); light-theme UI redesign with a deliberately-dark chalkboard.

**Conventions/gotchas future rounds must respect:**
- Backend errors: `ApiError`/`asyncHandler` (`backend/src/utils/`), not ad-hoc try/catch.
- Secrets: real keys only in gitignored `backend/.env`/`frontend/.env.local`; `.env.example`/`.env.local.example` stay scrubbed templates. User has pasted real keys into example files before — flag it if seen again.
- Never `npm run build` in `frontend/` while `npm run dev` is running (clobbers `.next`).
- `express-rate-limit` pinned at 7.x (no `ipKeyGenerator` export — local `ipBucket()` helper used).
- Windows machine, paths can contain spaces (`C:\Persnal Project\...`) — quote them; Bash tool (Git Bash) preferred for POSIX-style commands.
- Frontend feature-folder structure under `frontend/features/<domain>/`; UI primitives in `frontend/components/ui/`; auth state via `frontend/context/AuthContext.tsx`.
- Light theme tokens in globals.css (tinted background, indigo shadows, wash-* utilities); chalkboard components (`BoardSlideView`, `BoardDemo`) intentionally stay dark.

**Known gaps / open items (from project memory, not yet verified this session):**
- `studyNotes` (concept/notes/example pages) is serialized but not yet shown in the interactive lesson player — only in the PPT/PDF deck.
- Quiz `correctIndex` is sent to the client for instant feedback — soft grading integrity, flagged as a concern if payments/leaderboards are ever added.
- Voice-identity preservation (same-voice dubbing across languages) is unbuilt — needs paid ElevenLabs or a local clone model.
- Course/Learning-Path syllabi are English-only (translation not extended there yet).
- `.pptx` box sizing has not been visually verified (no LibreOffice/PowerPoint on this machine) — only the PNG/PDF path has been eyeballed.
- Mobile/narrow-viewport layout not verified for the redesigned landing/light theme.
- Wav2Lip avatar ML inference depends on a one-time local Python/torch/weights setup the user does outside this repo — don't assume it's available; check `AVATAR_ENABLED`/`isAvatarAvailable()` gating before building on top of it.

Git: single-branch (`main`), 2 commits ("first commit" x2), working tree clean except this new `.claude/` tooling. No CI configured that's visible in-repo.

## Backlog

- [x] ~~Surface `studyNotes` in the interactive lesson player~~ — DONE round 1, APPROVED by quality-checker.
- [ ] Do a real browser smoke-test of the round-1 Board/Study-notes tab switcher next time the dev server is up. NOT ACTIONABLE by this cycle's roles (no browser tooling) — leave for the user or a future cycle with browser access, not for product-manager to pick.
- [ ] Code-level responsive-class audit of the landing page + light theme (missing `sm:`/`md:`/`lg:` breakpoints, fixed pixel widths that could overflow narrow viewports) — reframed from the original browser-only version (round 5 product-manager); no browser needed, a static grep/read pass.
- [x] ~~Code-level touch-target/spacing audit of `InteractiveLesson.tsx` transport controls~~ — DONE round 9, APPROVED by quality-checker. Found real undersized targets (40px icon buttons, ~28px toggle pills, 8px-tall slide-dot hit areas) and fixed all to ~44px via className overrides, without touching the shared `Button` component.
- [x] ~~Rate-limit gap: `POST /api/generate/ppt`, `/audio`, `/video` had no rate limiter beyond `requireAuth`~~ — DONE round 6, APPROVED by quality-checker. Extended the existing `generationRateLimiter` to all 3 routes; live-verified engaging correctly (429 after 30/hour shared bucket exhausted) without breaking normal single-lesson generation (4 units/lesson).
- [ ] Quiz retake edge cases in `backend/src/controllers/review.controller.ts`: `submitQuizAttempt` marks a module `completed` on any ≥60% attempt; unclear what happens on a later lower-scoring retake (status likely stays `completed` — confirm intended) and whether retaking an already-completed module still updates review scheduling/`isReview` correctly. (round 5 product-manager)
- [x] ~~Module unlocking/prerequisite behavior~~ — DONE round 8, APPROVED by quality-checker. Confirmed a REAL gap (not intentional): server had no lock check, only the frontend did — a direct API call could generate any module out of order. Fixed in `generate.controller.ts`, live-verified end-to-end (negative/positive/regression/standalone cases + zero wasted Presentation docs on rejected attempts).
- [x] ~~Quiz options list in `backend/src/services/ppt.service.ts` had no truncation on `question.options[]`~~ — DONE round 7, APPROVED by quality-checker. Added `clip(option, 130)`, live-verified via a generated .pptx.
- [x] ~~Answer-key page overflow risk in `ppt.service.ts`~~ — DONE round 10 (ppt.service.ts half only), APPROVED by quality-checker. Clipped item.question/answer (200/220 chars) and correct-option/explanation (150/280 chars), live-verified via generated .pptx XML with word-boundary truncation confirmed.
- [x] ~~Answer-key page overflow risk in `slideRenderer.service.ts`'s `renderAnswerSlide`~~ — DONE round 11, APPROVED by quality-checker. Confirmed REAL (matches the file's own "never overflows" comment being false for this function). Fixed with a per-entry dynamic line-budget (mirroring `renderNotesSlide`'s existing pattern in the same file). Verified with an actual before/after rendered-PNG control: pre-fix visibly overflowed the footer, post-fix clean — the two `ppt.service.ts`/`slideRenderer.service.ts` halves of this backlog item are now both closed.
- [ ] Slide/example page title text in `ppt.service.ts`'s `addHeader()` — **IMPLEMENTED + TESTER-VERIFIED, NOT YET QUALITY-GATED** (round 12, interrupted by user `/dev-cycle stop` before quality-checker ran). frontend-designer added `clip(heading, 100)` to the shared `addHeader()` function (used by all 5 page builders; Notes/Example pages were the real worst offender at only 0.04in clearance). Tester generated a real .pptx with a 242-char title and confirmed via XML it truncates to exactly 98 chars + ellipsis (matching the documented budget, verified byte-identical against running `clip()` standalone), while a 19-char control title and all other `addHeader` callers rendered unchanged. **Next round should dispatch quality-checker on this diff first** (`git diff -- backend/src/services/ppt.service.ts`, focus only on the `addHeader` heading-clip hunk) before picking new work — do not re-implement, it's done and tester-passed, just unreviewed.
- [x] ~~Stop shipping `correctIndex`/`explanation` to the client before quiz submission~~ — DONE round 2, APPROVED by quality-checker.
- [x] ~~Extend course/Learning-Path syllabus generation to already-supported lesson languages (Hindi/Telugu/Tamil/Spanish)~~ — DONE round 3, APPROVED by quality-checker.
- [x] ~~Audit Wav2Lip/`AVATAR_ENABLED` gating end-to-end in the generate flow~~ — DONE round 4, APPROVED by quality-checker. Found and fixed a real bug (see cycle log).
- [x] ~~Spot-check `.pptx` box sizing via a scripted export/XML inspection~~ — DONE round 5, APPROVED by quality-checker. Found and fixed 7 real overflow bugs.

## Cycle Log
(most recent round first)

### Round 12 — 2026-08-17 — INTERRUPTED (partial)
- **Task:** Fix title wrap-overlap risk in `ppt.service.ts`'s shared `addHeader()` function (a bounded slice of the backlog's larger title-wrap item — clip the heading in the one shared function rather than restructuring every page's y-coordinates).
- **Roles run:** frontend-designer (done) → tester (done, PASS) → quality-checker (**not run — user called `/dev-cycle stop` before dispatch**).
- **Outcome:** PARTIAL. Implementation complete and tester-verified, but never quality-gated. Left as-is in the working tree (not reverted) since it's real, tested work — just needs review.
- **Files touched:** `backend/src/services/ppt.service.ts` only — `addHeader()`'s `heading` param wrapped in `clip(heading, 100)`, with a reasoned comment (26pt bold heading box sized for ~2 lines, accent rule ends at y:1.51, Notes/Example pages' right-column card starts at y:1.55 — only 0.04in clearance, so a 3rd wrapped line must never happen). No y-coordinates/box sizes changed; `addConceptPage`'s separate title box explicitly left alone (out of scope).
- **Verification so far:** typecheck clean. Tester generated a real .pptx with a 242-char title, confirmed via XML that the heading truncates to 98 chars + ellipsis (within the 100-char budget), byte-identical to running the same `clip()` algorithm standalone on the same input; a 19-char control title and the other 3 `addHeader` callers (practice/quiz/answer-key, short fixed strings) all rendered unchanged.
- **New backlog items:** none — see updated Backlog entry noting this needs quality-checker before being marked done.
- **Note:** changes uncommitted in the working tree, left for user review (stacks on rounds 1-11). **This is the one round in this activation that is not fully closed out.**

### Round 11 — 2026-08-17
- **Task:** Fix the `slideRenderer.service.ts` half of the answer-key overflow bug (round 10 fixed the `ppt.service.ts` half; this is the sibling PNG-renderer bug, a different failure mode — cumulative cursor drift across stacked entries, not a single unbounded string).
- **Roles:** frontend-designer → tester → quality-checker.
- **Outcome:** DONE / APPROVED.
- **Files touched:** `backend/src/services/slideRenderer.service.ts` only — `renderAnswerSlide` previously hardcoded max line counts (2 lead/3 detail) regardless of how many entries were stacked per page; now computes a per-entry vertical budget from available space ÷ entry count and derives line-count caps from it (clamped so 1-2 entry pages keep today's generous wrapping). Mirrors an existing pattern already used elsewhere in the same file (`renderNotesSlide`). Function signature and call sites unchanged.
- **Verification:** typecheck clean. Tester generated real worst-case PNGs via the actual render function, then ran a genuine before/after control — stashed the fix, regenerated the same worst-case PNG with the old hardcoded-cap code, and confirmed it visibly overflows (entry text overlapping the footer), then restored the fix and confirmed clean output with matching pixel counts across repeat runs. quality-checker independently re-derived the worst-case math from the diff's own constants (not trusting tester's numbers) and got identical results, confirmed the 4/3 entry counts are genuinely the real worst cases used by `renderDeck`, and confirmed short-content cases aren't over-clamped.
- **New backlog items:** none — this closes the last half of the answer-key overflow item.
- **Note:** changes uncommitted in the working tree, left for user review (stacks on rounds 1-10).

### Round 10 — 2026-08-17
- **Task:** Truncate answer-key text in `ppt.service.ts` (practice answers, quiz explanations, correct-option text) — a deliberately scoped slice of the larger "coordinated fix across two renderers" backlog item, since the full coordinated fix was judged too large/risky for one browser-less round.
- **Roles:** frontend-designer → tester → quality-checker.
- **Outcome:** DONE / APPROVED.
- **Files touched:** `backend/src/services/ppt.service.ts` only — added `clip()` calls to 4 previously-unbounded strings (item.question 200 chars, item.answer 220 chars, correct-option text 150 chars, question.explanation 280 chars), each cap derived from real box-height/font-size/line-spacing arithmetic with 30-50% slack, following the file's existing `clip()` pattern. `slideRenderer.service.ts`'s matching but differently-shaped overflow risk (cumulative cursor drift, not a single unbounded string) was explicitly left untouched and stays on the backlog.
- **Verification:** typecheck clean. Tester generated a real .pptx with 889-char stress strings, inspected the raw XML, and confirmed all four fields truncated at word boundaries under their caps (199/214/139/274 of 200/220/150/280) while normal-length control content rendered fully unclipped. quality-checker independently redid the box-math and confirmed the slack margins hold (~31% practice, ~42% quiz).
- **New backlog items:** none new — the `slideRenderer.service.ts` half of the original item was split out and kept open (see Backlog).
- **Note:** changes uncommitted in the working tree, left for user review (stacks on rounds 1-9).

### Round 9 — 2026-08-16
- **Task:** Code-level touch-target/spacing audit of `InteractiveLesson.tsx` transport controls.
- **Roles:** frontend-designer → tester → quality-checker.
- **Outcome:** DONE / APPROVED. Audit found real gaps: transport icon buttons (40x40px), board/notes toggle pills (~28px tall), auto-play toggle (~24-28px tall), and slide-dot navigation (8px-tall hit areas) all sat below the ~44px touch-target guideline.
- **Files touched:** `frontend/features/lesson/InteractiveLesson.tsx` only — sizing/className-only fixes (no prop/behavior changes): `h-11 w-11` on the 4 transport buttons, `min-h-11` on the toggle pills and auto-play toggle, and the slide-dot row restructured into an outer 44px-tall invisible hit-area button wrapping the original thin visible bar (preserving its progress-color logic unchanged). Deliberately did NOT touch the shared `components/ui/button.tsx` — scoped via per-instance overrides to avoid an unverifiable blast radius with no browser tooling this cycle.
- **Verification:** typecheck clean. Tester traced the `tailwind-merge`/`cn()` conflict resolution to confirm the className overrides actually win over the `Button` component's cva defaults, verified all four fix locations by class-arithmetic (Tailwind's `1` unit = 4px), and confirmed no prop/handler/aria-label changed. quality-checker independently re-verified the twMerge trace and accessibility (aria-labels intact, dots still individually distinguishable). Both correctly ignored round 1's pre-existing Board/Study-notes tab content sitting in the same file.
- **New backlog items:** none.
- **Note:** changes uncommitted in the working tree, left for user review (stacks on rounds 1-8).

### Round 8 — 2026-08-16
- **Task:** Investigate module unlocking/prerequisite behavior; confirmed a real security/integrity gap and fixed it.
- **Roles:** frontend-designer → tester → quality-checker.
- **Outcome:** DONE / APPROVED.
- **Files touched:** `backend/src/controllers/generate.controller.ts` only — added a server-side lock check to `generateContent`: when `courseId`+`moduleIndex` are present, rejects with 403 unless every earlier-indexed module in that course has `status === "completed"` (mirrors `PathDetail.tsx`'s existing frontend-only lock logic, which a direct API call could previously bypass entirely). Check runs before any AI call or `Presentation.create`, and the course ownership lookup returns an identical 404 whether the course doesn't exist or belongs to another user (no user-enumeration leak).
- **Verification:** typecheck clean. Tester ran a full live end-to-end test against the real backend/DB with real AI calls: negative case (blocked, 403, no side effects), positive case (unlocked module succeeds), regression (still blocked when predecessor is merely "generated" not "completed"), standalone-generation regression (unaffected), and full closure (pass quiz → predecessor "completed" → next module unlocks). DB-level check confirmed the two rejected attempts created zero stray Presentation documents. quality-checker independently verified the lock condition is mathematically equivalent to the frontend's `activeIndex`/`isLocked` logic (no off-by-one) and confirmed no ownership-check side channel.
- **New backlog items:** none.
- **Note:** changes uncommitted in the working tree, left for user review (stacks on rounds 1-7).

### Round 7 — 2026-08-16
- **Task:** Truncate quiz-option text in the .pptx "Check yourself" slide (last un-truncated block from round 5's overflow sweep).
- **Roles:** frontend-designer → tester → quality-checker.
- **Outcome:** DONE / APPROVED.
- **Files touched:** `backend/src/services/ppt.service.ts` only — added `clip(option, 130)` to the 4 quiz options, label prefix (`A)`/`B)`/etc.) kept unclipped, following the exact pattern of round 5's 7 other `clip()` sites with a measured-reasoning comment.
- **Verification:** typecheck clean. Tester ran `buildPptx` standalone with a real 160-char-option fixture, generated an actual .pptx, unzipped it, and confirmed in the raw XML that options were truncated to the expected length with the ellipsis while the label prefix stayed intact. quality-checker independently sanity-checked the box-geometry reasoning behind the chosen cap (130 chars, safe margin against the schema's 160-char worst case).
- **New backlog items:** none.
- **Note:** changes uncommitted in the working tree, left for user review (stacks on rounds 1-6).

### Round 6 — 2026-08-16
- **Task:** Close the unbounded expensive-endpoint rate-limit gap on `/generate/ppt`, `/generate/audio`, `/generate/video`.
- **Roles:** frontend-designer → tester → quality-checker.
- **Outcome:** DONE / APPROVED.
- **Files touched:** `backend/src/routes/generate.routes.ts` only — added the existing `generationRateLimiter` middleware to all 3 routes, matching the pre-existing `/content` pattern (shared 30/hour-per-user bucket, no new limiter invented).
- **Verification:** typecheck clean. Tester live-verified against the real dev backend + DB: normal single-shot generation for a real user unaffected (only 3-4 of 30 budget consumed per full lesson), and the limiter genuinely engages — 35 rapid calls produced 429s with the exact expected message after 30, and the bucket was confirmed shared across all four generation endpoints. quality-checker independently confirmed a single lesson generation only calls each endpoint once (no retry loops that could burn the budget unexpectedly) and verified tester's claims against the actual code (including a non-obvious detail: the 1-hour window is hardcoded, independent of the `RATE_LIMIT_WINDOW_MINUTES` env var).
- **New backlog items:** none.
- **Note:** changes uncommitted in the working tree, left for user review (stacks on rounds 1-5).

### Round 5 — 2026-08-16
- **Task:** Scripted spot-check of .pptx box-sizing/overflow risk in `ppt.service.ts`.
- **Roles:** frontend-designer → tester → quality-checker. (First frontend-designer dispatch was interrupted by the user mid-run and re-dispatched with the module-resolution issue it had hit already solved in the prompt.)
- **Outcome:** DONE / APPROVED.
- **Files touched:** `backend/src/services/ppt.service.ts` only. Added a `clip(text, maxChars)` word-boundary-truncation helper and applied it to 7 fields found to genuinely overflow their boxes under real schema-max-length content (notes explanation, keyFacts, definitions meaning, example problem, example steps, practice question, quiz question) — verified by generating real .pptx files and measuring actual EMU box coordinates in the extracted XML, independently by both frontend-designer and tester.
- **Notable:** the task's original lead suspect (the "Now you try" fixed-height card) was investigated and found to be safe, not a bug — correctly left unfixed rather than "fixed" defensively. Two leftover test-artifact files were found by tester and cleaned up by the orchestrator before quality-checker's pass.
- **New backlog items:** 8 — product-manager's proposals (rate-limit gap, quiz-retake edge cases, module-unlocking behavior, 2 reframed browser-dependent items) plus quality-checker's 3 follow-ups (quiz options overflow, answer-key page overflow, title-wrap overlap) — see Backlog.
- **Note:** changes uncommitted in the working tree, left for user review (stacks on rounds 1-4).

### Round 4 — 2026-08-16
- **Task:** Audit Wav2Lip/`AVATAR_ENABLED` gating end-to-end in the generate flow.
- **Roles:** frontend-designer → tester → quality-checker.
- **Outcome:** DONE / APPROVED. The audit (done by product-manager before dispatch) found a real bug: the video-processing banner's "(longer with the AI presenter)" hint was driven by `lesson.hasAvatar`, which the backend only sets after a render *completes* — so it always reflected the previous render's outcome, never the one currently in flight (always false on a first render, stale after any config change).
- **Files touched:** `frontend/features/lesson/LessonDetail.tsx` only — replaced the stale-data-dependent conditional with a neutral, non-committal line ("this can take a few minutes (longer if the AI presenter is enabled)…"). The correct `hasAvatar` badge (gated on `status.video === "ready"`) was left untouched.
- **Verification:** typecheck clean. Tester and quality-checker both correctly distinguished this round's single hunk from an unrelated, already-approved Quiz-component hunk co-located in the same file (round 2's leftover work) — the scoped-diff fix from round 3's process note worked as intended this time, no false BLOCKED.
- **New backlog items:** none.
- **Note:** changes uncommitted in the working tree, left for user review (stacks on rounds 1-3).

### Round 3 — 2026-08-16
- **Task:** Extend Learning-Path (course) syllabus generation to Hindi/Telugu/Tamil/Spanish, matching the existing per-lesson translation pattern (author in English, then translate; `requireStrongModel: true`; resilient fallback to English on failure/length-mismatch).
- **Roles:** frontend-designer → tester → quality-checker (re-reviewed once, see note).
- **Outcome:** DONE / APPROVED.
- **Files touched:** `backend/src/models/Course.ts` (new `language` field), `backend/src/services/coursePlanner.service.ts` (new `translateCoursePlan`, `planCourse` gained `language` param), `backend/src/controllers/course.controller.ts` (schema + persistence + serialization), `frontend/lib/types.ts` (`CourseView.language`), `frontend/services/lessons.service.ts`, `frontend/hooks/useLearning.ts`, `frontend/features/paths/PathsView.tsx` (new language picker), `frontend/features/paths/PathDetail.tsx`, `frontend/app/dashboard/generate/page.tsx`, `frontend/features/generate/GenerateForm.tsx`.
- **Verification:** typecheck clean. Tester live-verified end-to-end against the real dev backend + DB: default-to-English with no `language` sent, real Hindi course creation producing genuine Devanagari with technical terms preserved in Latin script, `goal` never mutated, pre-existing DB courses (no `language` field) correctly backfill to `"en"` via Mongoose default. Confirmed `requireStrongModel: true` used and the positional array-length-mismatch fallback guard is real and correctly wired.
- **Process note:** quality-checker's first pass BLOCKED on a false positive — it mistook rounds 1 and 2's already-approved, still-uncommitted changes (elsewhere in the working tree) for scope creep in round 3, because it wasn't told the working tree accumulates approved-but-uncommitted rounds. Re-dispatched with a scoped `git diff` limited to round 3's actual files → APPROVED. **Fixed the orchestrator (`SKILL.md`) so future rounds tell tester/quality-checker which files are this round's and to diff scoped to them, not the whole tree** — this shouldn't recur.
- **New backlog items:** none.
- **Note:** changes uncommitted in the working tree, left for user review (stacks on rounds 1 and 2).

### Round 2 — 2026-08-16
- **Task:** Stop shipping quiz `correctIndex`/`explanation` to the client before submission (grading-integrity leak).
- **Roles:** frontend-designer → tester → quality-checker.
- **Outcome:** DONE / APPROVED.
- **Files touched:** `backend/src/utils/serialize.ts` (trimmed `quiz` field to `{question, options}`), `backend/src/controllers/review.controller.ts` (added `answerKey` to post-grading response only), `frontend/lib/types.ts` (`QuizQuestion` trimmed, `QuizAttemptResult` gained `answerKey`), `frontend/features/lesson/LessonDetail.tsx` (Quiz component sources correctness/explanation from `result.answerKey` post-grading).
- **Verification:** typecheck clean (re-run independently by tester and quality-checker). Server-side scoring trust model confirmed unchanged (still computed from DB doc, never client input). Confirmed export/PPTX/PDF answer-key path untouched (still gets full data, by design). quality-checker swept all controllers touching `.quiz` and found no other leak path.
- **New backlog items:** none.
- **Note:** changes uncommitted in the working tree, left for user review (stacks on top of round 1's uncommitted changes).

### Round 1 — 2026-08-16
- **Task:** Surface `studyNotes` in the interactive lesson player.
- **Roles:** ui-designer → frontend-designer → tester → quality-checker.
- **Outcome:** DONE / APPROVED.
- **Files touched:** `frontend/lib/types.ts` (new `StudyNotesView`-family types), `frontend/features/lesson/StudyNotesPanel.tsx` (new), `frontend/features/lesson/InteractiveLesson.tsx` (tab switcher wiring). No backend changes.
- **Verification:** `npm run typecheck` clean (re-run independently by tester and quality-checker). Tester found a real lesson in the live DB with fully-populated `studyNotes` exercising every rendered branch. Live browser rendering was not visually checked (no browser tool in that subagent) — logged as a non-blocking follow-up backlog item.
- **New backlog items:** 1 (browser smoke-test follow-up, see Backlog).
- **Note:** changes are uncommitted in the working tree, left for user review.
