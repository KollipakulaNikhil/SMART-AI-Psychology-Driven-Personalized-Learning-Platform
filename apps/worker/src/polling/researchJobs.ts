import { ResearchProject } from "@smart-ai/core/models/ResearchProject";
import { logger } from "@smart-ai/core/utils/logger";
import { runResearchPipeline } from "../services/research.service";

const POLL_INTERVAL_MS = 4_000;
const MAX_CONCURRENT = 3;

/**
 * Polls Mongo for research projects the web app created with `status:
 * "queued"` and runs the prior-art search → snapshot → ideation pipeline.
 * The atomic `findOneAndUpdate` below is the claim: only one worker instance
 * can flip a given project from "queued" to "searching".
 */
export function startResearchJobPoller(): () => void {
  const active = new Set<string>();
  let stopped = false;

  async function tick() {
    if (stopped || active.size >= MAX_CONCURRENT) return;

    const candidates = await ResearchProject.find({ status: "queued" })
      .select("_id")
      .limit(MAX_CONCURRENT)
      .lean();

    for (const candidate of candidates) {
      const id = String(candidate._id);
      if (active.has(id) || active.size >= MAX_CONCURRENT) continue;

      const claimed = await ResearchProject.findOneAndUpdate(
        { _id: candidate._id, status: "queued" },
        { $set: { status: "searching", stageMessage: "Reading your idea and planning search queries…" } }
      );
      if (!claimed) continue; // another instance claimed it first

      active.add(id);
      runResearchPipeline(claimed._id)
        .catch((error) =>
          logger.error("Unhandled error in research job", { projectId: id, error: error instanceof Error ? error.stack : String(error) })
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
