import { z } from "zod";
import { Types } from "mongoose";
import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parseParams } from "@/lib/api/validate";
import { getPresentation } from "@/lib/controllers/generate.controller";

const idParam = z.object({ id: z.string().refine(Types.ObjectId.isValid, "Invalid lesson id") });

export const GET = apiHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  const { id } = await parseParams(idParam, ctx.params);
  return getPresentation(user, id);
});
