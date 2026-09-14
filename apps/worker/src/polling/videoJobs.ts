import { Presentation } from "@smart-ai/core/models/Presentation";
import { logger } from "@smart-ai/core/utils/logger";
import { runVideoJob } from "../services/videoJob.service";

const POLL_INTERVAL_MS = 4_000;
/** Cap on how many lessons this single worker instance renders at once. */
const MAX_CONCURRENT = 2;

/**
 * Polls Mongo for lessons the web app flipped to `status.video: "processing"`
 * and renders them. This replaces the old Express server's in-process
 * fire-and-forget `void runVideoJob(...)` — the web route now only ever
 * writes the "processing" status and returns; this worker is what actually
 * claims and runs the job.
 */
export function startVideoJobPoller(): () => void {
  const active = new Set<string>();
  let stopped = false;

  async function tick() {
    if (stopped || active.size >= MAX_CONCURRENT) return;

    const candidates = await Presentation.find({ "status.video": "processing" })
      .select("_id userId")
      .limit(MAX_CONCURRENT)
      .lean();

    for (const candidate of candidates) {
      const id = String(candidate._id);
      if (active.has(id) || active.size >= MAX_CONCURRENT) continue;

      active.add(id);
      // Re-stamping videoJobStartedAt is the claim: only a doc still in
      // "processing" gets touched, so a second worker instance racing this
      // same tick simply finds nothing left to claim on its own query.
      Presentation.updateOne({ _id: candidate._id, "status.video": "processing" }, { $set: { videoJobStartedAt: new Date() } })
        .then(() =>
          runVideoJob(id, candidate.userId).catch((error) =>
            logger.error("Unhandled error in video job", { presentationId: id, error: error instanceof Error ? error.stack : String(error) })
          )
        )
        .finally(() => active.delete(id));
    }
  }

  const timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
  void tick();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
