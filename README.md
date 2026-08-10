# SMART AI — Psychology-Driven Personalized Learning

SMART AI first understands **how you learn**, then generates video lessons engineered for your
mind. A 20-question psychology assessment builds a learner profile (style, attention span, pace,
knowledge level, tone, memory strategy…), and every stage of generation — content, slide design,
imagery, narration speed, quiz length — adapts to it. **The same topic produces genuinely
different lessons for different people.** That is the product.

```
Landing → Login (Firebase) → Dashboard → Psychology questionnaire → Learning profile
       → Topic input → AI storytelling script (Gemini, Groq fallback) → PPT + PDF (PptxGenJS/pdfkit)
       → Human narration (ElevenLabs) → Animated digital-board video, optional lip-synced
         presenter (FFmpeg + Wav2Lip) → Downloads → History & analytics
```

## Repository layout

```
├── backend/                 Express + TypeScript REST API
│   ├── src/
│   │   ├── config/          env validation, MongoDB, Firebase Admin
│   │   ├── controllers/     auth, profile, questionnaire, generate, history, download, analytics
│   │   ├── middleware/      Firebase auth guard, zod validation, rate limiting, error handler
│   │   ├── models/          User, LearningProfile, Presentation, GeneratedVideo, History, RecentTopic
│   │   ├── prompts/         20 psychology questions · trait scoring · adaptive prompt engine
│   │   ├── routes/          /api/* route definitions
│   │   ├── services/        Gemini + Groq (auto-fallback), Pexels, ElevenLabs, slide + board renderer, PPTX, PDF, FFmpeg video, talking-head
│   ├── avatar/              optional Wav2Lip/SadTalker setup (README + setup checker)
│   │   └── utils/           logger, ApiError, retry with backoff, path/url helpers
│   ├── uploads/images/      fetched slide imagery (per lesson)
│   └── generated/           ppt/ · pdf/ · audio/ · video/ · slides/ artifacts
└── frontend/                Next.js 15 + TypeScript + Tailwind
    ├── app/                 landing, login, dashboard, questionnaire, generate, lesson/[id], history, profile
    ├── components/          shadcn-style UI kit + dashboard shell
    ├── features/            auth, questionnaire, generate pipeline, lesson, history, analytics, profile, landing
    ├── hooks/               React Query hooks + generation pipeline state machine
    ├── context/             AuthContext (Firebase) + app providers
    ├── services/            typed API client with token injection
    └── lib / styles/        types, constants, firebase client, theme
```

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js ≥ 20 | tested on Node 26 |
| MongoDB | local `mongod` or a free MongoDB Atlas cluster |
| Firebase project | Authentication with **Google** and **Email/Password** providers enabled |
| Gemini API key **and/or** Groq API key | https://aistudio.google.com/apikey · https://console.groq.com/keys — at least one is required; if both are set, Gemini is tried first and Groq is the automatic fallback on any failure (quota, outage, etc.) |
| Pexels API key | https://www.pexels.com/api/ (optional — branded gradient art is used as fallback) |
| ElevenLabs API key | https://elevenlabs.io (required for narration + video stages) |
| FFmpeg | **bundled automatically** via `ffmpeg-static` — no manual install needed |
| Talking-head avatar | **optional** — board-only video works with no setup; for the lip-synced presenter see [`backend/avatar/README.md`](backend/avatar/README.md) (Python + Wav2Lip, one-time) |

## Setup

### 1. Install

```bash
npm run install:all        # installs backend + frontend
npm install                # root dev tooling (concurrently)
```

### 2. Firebase

1. Create a project at https://console.firebase.google.com
2. **Authentication → Sign-in method**: enable *Google* and *Email/Password*.
3. **Project settings → General → Your apps → Web app**: copy the web config values.
4. **Project settings → Service accounts → Generate new private key**: save the JSON as
   `backend/serviceAccount.json` (git-ignored).

### 3. Environment

```bash
# backend
cp backend/.env.example backend/.env         # fill in MONGODB_URI, GEMINI_API_KEY and/or
                                             # GROQ_API_KEY, PEXELS_API_KEY, ELEVENLABS_API_KEY
# frontend
cp frontend/.env.local.example frontend/.env.local   # fill in the Firebase web config
```

### 4. Run

```bash
npm run dev        # API on :5000 + web on :3000 together
# or separately:
npm run dev:backend
npm run dev:frontend
```

Open http://localhost:3000, sign in, take the assessment, and generate a lesson.

## API surface

All routes require `Authorization: Bearer <Firebase ID token>` (verified server-side by
Firebase Admin; users are upserted into MongoDB on first sight).

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/session` | verify token, upsert user, return session bootstrap |
| GET | `/api/auth/me` | current user + profile flag |
| GET | `/api/profile` | learner traits (or `null` before assessment) |
| GET | `/api/questionnaire` | the 20 questions (scoring weights stay server-side) |
| POST | `/api/questionnaire` | score answers → learning profile (retake bumps version) |
| GET | `/api/generate/languages` | languages this server can narrate (drives the picker) |
| POST | `/api/generate/content` | AI lesson (Gemini → Groq fallback) + per-slide Pexels imagery *(rate-limited)* |
| POST | `/api/generate/ppt` | render deck PNGs + build PPTX + PDF |
| POST | `/api/generate/audio` | ElevenLabs narration per slide + combined MP3 |
| POST | `/api/generate/video` | FFmpeg: slides + narration + fades → MP4 |
| GET | `/api/generate/:id` | full lesson detail / stage status |
| GET | `/api/history` | paginated lesson list |
| GET | `/api/history/recent-topics` | quick-repeat topics |
| GET | `/api/history/activity` | activity feed |
| GET | `/api/download/:id/:asset` | authenticated download — `ppt` `pdf` `audio` `video` `subtitles` |
| GET | `/api/analytics` | lessons, learning time, favorite subjects, avg video length |

Generated media previews (slide PNGs, in-app video playback) are served from `/static/*`.

## How personalization actually works

1. `prompts/questions.ts` — every questionnaire option casts **weighted votes** into 12 trait
   dimensions; questions deliberately overlap so one answer can't skew a trait.
2. `prompts/profileBuilder.ts` — votes are tallied into the profile object
   (`learningStyle, attentionSpan, pace, knowledgeLevel, tone, depth, visualPreference,
   examplePreference, motivation, memoryType, confidence, revisionFrequency`), then
   `deriveGenerationParams()` converts traits into concrete knobs: slide count, bullets per
   slide, words per bullet, narration words per slide, quiz length, TTS speed, image emphasis.
3. `prompts/promptEngine.ts` — builds a provider-agnostic prompt with **hard numbered
   requirements** from those knobs, plus a shared `runContentGeneration()` contract (ask →
   validate against a strict zod schema → one automated repair round on failure) reused by
   every AI provider.
4. `services/aiContent.service.ts` — tries each configured provider in order (**Gemini first,
   Groq as automatic fallback**) so a quota outage on one doesn't block generation; `gemini.service.ts`
   and `groq.service.ts` each just wrap their own API call around the same shared contract.
5. The same knobs then drive PPTX layout density, SVG slide rendering, ElevenLabs voice
   (tone → voice, pace → speaking speed) and therefore final video length.

## The lesson video (digital board + optional presenter)

Lessons render as a **spoken explainer on an animated digital board**, not a static slideshow:

- **Storytelling script** — the prompt forces natural, spoken delivery (contractions, direct
  address, a running narrative), adapted per profile (`deliveryStyle`/`boardGuidance` in
  `profileBuilder.ts`). ElevenLabs runs with expressive settings tuned by tone.
- **Animated board** (`services/boardRenderer.service.ts`) — a dark teaching board where the
  heading, key terms, **written explanation notes** and a **drawn diagram** (flow / cycle /
  compare / list, chosen to fit the concept and the learner) are **progressively revealed** in
  time with the narration. Rendered as SVG→PNG frames via sharp — no headless browser.
- **Per-lesson options** — the generate form offers a target **duration** (2–15 min, or Auto
  matched to the profile), an **explanation depth** (Quick / Standard / In-depth — In-depth adds
  board notes and "why + worked example" narration), and a **subtitles** toggle.
- **Subtitles** (`services/subtitle.service.ts`) — SRT + WebVTT cues timed from the *measured*
  narration durations: shown as a CC track in the player, downloadable as `.srt`, and burned
  into the MP4 via ffmpeg/libass (burn-in failure gracefully degrades to CC-track-only).
- **Video assembly** (`services/video.service.ts`) — per-slide reveal frames are timed to each
  narration clip, concatenated, and finalized to MP4 (optional background music mixed last).
- **Optional talking-head presenter** (`services/talkingHead.service.ts`) — a lip-synced
  Wav2Lip/SadTalker face composited into the bottom-left (the zone the board keeps clear). It's
  **off by default and fully gated**: without the one-time Python setup the pipeline silently
  ships a board-only video. Setup + a `check-setup.mjs` verifier live in
  [`backend/avatar/`](backend/avatar/README.md).

The PowerPoint deck and PDF handout are still generated as downloadable extras.

## Interactive lesson player (the primary experience)

Lessons are learned in an **interactive, self-paced board player rendered live in the browser**
(`features/lesson/InteractiveLesson.tsx`), not a passive video:

- The board renders in React from the lesson data and **reveals progressively** in time with the
  narration (`BoardSlideView.tsx`).
- **Narration** has three tiers so it always works: premium **ElevenLabs** → free server-side
  **Microsoft Edge neural TTS** (`msedge-tts`, no key/quota, and it bakes into the downloadable
  video) → free **browser voice** (Web Speech API, live-only) as the last resort in the player.
  A lesson is playable and narrated the instant content exists, even with no ElevenLabs key.
- **Click any board term** to instantly ask the tutor about it; self-paced controls (play/pause,
  prev/next, replay, auto-advance).
- **No video wait**: generation opens the interactive lesson right after narration; the
  downloadable MP4 renders in the background and appears on the page when ready. Slides + narration
  failures are non-fatal — the interactive lesson still opens (browser voice).

## Multilingual lessons (free)

Pick a language on the generate form and the **whole lesson** switches — narration,
board, slides, subtitles, quiz and the AI tutor:

| Language | Narration voice |
|---|---|
| English · हिन्दी · తెలుగు · தமிழ் · Español | Microsoft Edge neural voices |

- **Zero cost, no API key.** Narration uses the free Edge neural voices already bundled
  via `msedge-tts` (322 voices / 142 locales). Because it is synthesized server-side it
  **bakes into the downloadable MP4** — unlike the browser voice, which is live-only.
- **English-first, then translated.** The lesson is authored in English (where the content
  prompt and the models are strongest) and translated by `services/translation.service.ts`.
  Translation runs **per slide** so the free Groq per-minute token budget isn't blown by one
  giant call, and any part that fails to translate simply stays in English rather than
  failing the lesson.
- **Array lengths are enforced.** A translated slide whose points/terms/quiz options changed
  count is rejected field-by-field — the board reveal is timed to those arrays, and the quiz's
  correct answer is tracked by option *position*.
- **Adding a language** means one entry in `backend/src/config/languages.ts` (the single
  source of truth for both the picker and the TTS voice) — verify the voice names against
  `MsEdgeTTS.getVoices()` first.
- Non-English lessons skip ElevenLabs and go straight to the free Edge voice; burned-in
  subtitles switch to `Nirmala UI` for Indic scripts, since libass does not fall back per glyph.

## Studying features (lesson page)

- **AI Tutor chat** (`controllers/tutor.controller.ts`) — a doubt-solving tutor beside the video.
  Its edge over a generic chatbot: it's **grounded in this lesson's actual narration** and **knows
  the exact slide you're watching** (tracked from the video position), so "I don't get this part"
  resolves to the concept on screen. It answers in your psychological style, and can quiz you on
  the spot. Quick-action chips: *explain simply · give an example · give an analogy · quiz me*.
- **Clickable chapters** — the video's slide chapters (computed from narration timings) let you
  jump straight to any concept; the active chapter highlights as the video plays.
- **Duration targeting** — a chosen length now sizes the *slide count* (not just per-slide length,
  which language models chronically under-write) and runs a server-side expansion round if the
  narration comes back short. Accuracy is provider-dependent: Gemini lands close to target;
  Groq's free Llama is more brevity-biased so it lands lower but far better than before.

## Learning Paths & Smart Review (the retention loop)

SMART AI doesn't stop at generating a lesson — it closes the loop on whether you *remember* it:

- **Learning Paths** (`/dashboard/paths`) — give a goal ("get job-ready with SQL") and the AI
  plans a personalized **roadmap of sections → subtopic lessons** (`coursePlanner.service.ts`):
  3-5 sections (chapters), each with its own lessons, sized to your attention span, starting point
  set by your knowledge level, arc framed by your motivation. Each lesson generates through the
  normal pipeline and links back to the roadmap; passing its quiz (≥60%) completes it and unlocks
  the next.
- **Smart Review** (`services/review.service.ts`) — every finished quiz is graded server-side and
  fed into an **SM-2 spaced-repetition schedule**: strong scores stretch the interval
  (1 → 3 → ~8 days → …), weak ones reset it to tomorrow. The dashboard's Smart Review card shows
  what's due today with one-click review.
- **Study streak** — consecutive days with real learning activity (lesson generated or quiz
  finished), shown on the dashboard stats row.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/courses` | plan a personalized Learning Path from a goal *(rate-limited)* |
| GET | `/api/courses` / `/api/courses/:id` | list / detail with module progress |
| DELETE | `/api/courses/:id` | remove a path |
| GET | `/api/review/due` | lessons due for spaced-repetition review |
| POST | `/api/review/quiz-attempt` | grade a quiz, update the SM-2 schedule, streak & module completion |

## Production notes

- **Security**: Helmet, strict CORS, per-user rate limits on generation, zod validation on every
  input, Firebase ID-token verification on every route, download ownership checks, secrets only
  via environment.
- **Resilience**: Gemini → Groq automatic fallback for content generation; exponential-backoff
  retries around every external API (Pexels/ElevenLabs) with fail-fast on non-recoverable errors
  (dead quotas) and wait-and-retry-once on transient per-minute rate limits (Groq); per-stage
  status tracking (`pending/processing/ready/failed`) persisted on the lesson; structured Winston
  logs (`backend/logs/`).
- **Storage** is local-disk for the MVP (`backend/uploads`, `backend/generated`). Swap
  `utils/paths.ts` + the static mounts for S3/GCS when scaling out.
- Slide preview PNGs are served statically under unguessable Mongo ids for `<img>`/`<video>`
  embedding; the download endpoints remain fully authenticated. Move previews behind signed URLs
  when multi-tenant privacy matters.
- Optional: set `BACKGROUND_MUSIC_PATH` in `backend/.env` to an mp3 to mix soft music under
  every lesson video.

## Scripts

| Where | Script | What |
|---|---|---|
| root | `npm run dev` | backend + frontend together |
| root | `npm run typecheck` | strict TS across both projects |
| backend | `npm run dev` / `build` / `start` | tsx watch / compile to `dist` / run compiled |
| frontend | `npm run dev` / `build` / `start` | Next.js dev / production build / serve |
