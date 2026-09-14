import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parseParams } from "@/lib/api/validate";
import { deleteResearch, getResearch, researchIdParam } from "@/lib/controllers/research.controller";

export const GET = apiHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  const { id } = await parseParams(researchIdParam, ctx.params);
  return getResearch(user, id);
});

export const DELETE = apiHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  const { id } = await parseParams(researchIdParam, ctx.params);
  return deleteResearch(user, id);
});
