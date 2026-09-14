import { apiHandler } from "@/lib/api/apiHandler";
import { requireAuth } from "@/lib/api/requireAuth";
import { parseJson } from "@/lib/api/validate";
import { getQuestions, submitAnswers, submitAnswersSchema } from "@/lib/controllers/questionnaire.controller";

export const GET = apiHandler(async (req) => {
  await requireAuth(req);
  return getQuestions();
});

export const POST = apiHandler(async (req) => {
  const user = await requireAuth(req);
  const body = await parseJson(submitAnswersSchema, req);
  return submitAnswers(user, body);
});
