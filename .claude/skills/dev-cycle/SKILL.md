---
name: dev-cycle
description: Runs an autonomous self-pacing development cycle over the SMART AI project. Each round a product-manager agent picks one task and routes it through ui-designer/frontend-designer/tester/quality-checker, then the cycle reschedules itself. Starts only on explicit "/dev-cycle start" and keeps running until "/dev-cycle stop". Use only when the user invokes /dev-cycle directly — never start this on your own initiative.
---

You are executing the `/dev-cycle` orchestrator directly (not delegating this skill itself to a subagent — you need ScheduleWakeup, which only you have). The state file is `.claude/dev-cycle/state.md` in the project root. Five role subagents already exist at `.claude/agents/`: `product-manager`, `ui-designer`, `frontend-designer`, `tester`, `quality-checker` — dispatch to them with the Agent tool using `subagent_type` matching those names.

**Never start or continue a cycle unless this skill was explicitly invoked this turn.** This is a manually-activated loop, not a background habit.

## Parse the invocation argument

- `start` — activate the cycle (only if currently inactive; if already active, tell the user and do nothing else).
- `stop` — deactivate the cycle.
- *(no argument)* — this is a scheduled continuation (fired by your own prior `ScheduleWakeup`). Run one round. If the state file says `status: inactive` (user stopped it since the last wakeup, or it was never started), do nothing and don't reschedule — just stop silently, this is a stale wakeup.

## `/dev-cycle stop`

1. Read `.claude/dev-cycle/state.md`.
2. Edit it: set `status: inactive`.
3. Call `ScheduleWakeup` with `stop: true` to cancel the pending wakeup.
4. Tell the user: rounds completed this activation, and a one-line summary of the last few backlog items / open follow-ups from the Cycle Log, so they know where things stand.

## `/dev-cycle start`

1. Read `.claude/dev-cycle/state.md`. If `status: active` already, tell the user it's already running and stop here.
2. If the **Research Summary** section is still empty (first-ever start, or it was cleared), do a one-time project research pass now:
   - Read root `package.json` / `CLAUDE.md` if present, `backend/package.json`, `frontend/package.json`.
   - Skim directory structure of `backend/src/` and `frontend/` (routes, services, models, features) via Glob — enough to know what exists, not a full read of every file.
   - `git log --oneline -20` and `git status` for recent trajectory and current tree state.
   - Check memory (`smart-ai-mvp` project memory, if loaded in context) for architecture/decisions already known — don't rediscover what's already documented, just fold it in.
   - Write a dense but complete Research Summary into the state file: stack, architecture highlights, known gaps/unfinished pieces, established conventions/gotchas future rounds must respect. This is written **once** and reused by every future round — make it good.
   - Seed the **Backlog** by asking `product-manager` (Agent tool, `subagent_type: "product-manager"`) to propose 5-8 concrete candidate tasks from the research summary + known gaps. Write them into the Backlog section as a checklist with a one-line rationale each.
3. Edit the state file: `status: active`, `started_at: <current timestamp>`, keep `round_count` as-is.
4. Run one round now (see "Running a round" below) — don't wait for the first scheduled wakeup.

## Running a round (used by `start`'s first round and every scheduled continuation)

1. Read `.claude/dev-cycle/state.md` in full: Research Summary, Backlog, and the last 3-5 Cycle Log entries.
2. Dispatch `product-manager` (Agent tool, fresh agent, `subagent_type: "product-manager"`). In the prompt, paste the Research Summary, the current Backlog, and the recent Cycle Log entries — it has no other context. Ask it to return its decision in the format its own instructions specify (TASK / WHY / ROLES IN ORDER / per-role prompts, or NEW BACKLOG ITEMS if it proposed fresh ones).
3. Dispatch each role in the order product-manager specified, one at a time (each is a fresh agent — hand it exactly the prompt product-manager wrote for it, verbatim). Wait for each to finish before dispatching the next; later roles often need to know what earlier roles actually did, so briefly append the previous role's summary to the next role's prompt.
   - **Scope note for tester/quality-checker prompts:** because changes are never auto-committed (see Guardrails), the working tree accumulates every approved prior round's uncommitted edits. A generic `git diff`/`git status` will show all of them, not just this round's. Always tell tester and quality-checker (a) the exact file list this round's task actually touched, and (b) that any other uncommitted file in the tree belongs to an already-approved earlier round, not scope creep — and point them at `git diff -- <this round's files>` (a scoped diff) rather than a bare `git diff` for their scope check. Skipping this causes a false BLOCKED verdict on old, already-approved work.
4. If `quality-checker` (or `tester`) reports blocking issues, the task is **not** done — add the specific issues as new Backlog items (not a retry in this same round) rather than looping further this round.
5. Update the state file:
   - Append one entry to the top of **Cycle Log**: round number, timestamp, task title, roles involved, outcome (done / blocked / partial), files touched (short list), any new backlog items spawned.
   - Update **Backlog**: mark the task done (or update its status), add any new items.
   - Increment `round_count`, set `last_round_at`.
6. Tell the user a short summary in chat (2-4 sentences): what got done this round, current backlog size, anything that needs their attention (e.g. missing credentials, a blocking decision only they can make).
7. If `status` is still `active` (i.e. nobody called stop mid-round), schedule the next round: `ScheduleWakeup(delaySeconds: 1500, prompt: "/dev-cycle", reason: "<one line: next dev-cycle round>", noop: false)`. Use something in the 1200-1800s range by default; there's no need to run rounds back-to-back — this is unattended background work, not a race.
8. If `status` became `inactive` during this round (rare — only if something else stopped it), don't reschedule.

## Guardrails (apply every round, every role)

- Never `git commit` or `git push` automatically. Round changes stay as uncommitted working-tree edits; the user reviews and commits when they choose. Say this plainly in your round summary so it's never a surprise.
- Never touch `.env`, `.env.local`, or `serviceAccount.json`, and never let a role paste a real credential into `.env.example`/`.env.local.example`.
- Never install/upgrade dependencies, run destructive git operations, or modify `.claude/` orchestration files themselves as part of a round's task.
- If a role's dispatch reveals the task is blocked on something only the user can resolve (missing API key, ambiguous product decision, credentials), stop escalating through roles — log it as blocked in the Cycle Log/Backlog and surface it clearly in the chat summary, then still schedule the next round (so the cycle keeps making progress on other backlog items instead of stalling).
