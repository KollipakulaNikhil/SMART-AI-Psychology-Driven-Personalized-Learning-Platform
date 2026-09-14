import type { ZodTypeAny, z } from "zod";

/** Route params in Next 15 arrive as an async record — resolve then zod-parse. */
export async function parseParams<T extends ZodTypeAny>(
  schema: T,
  paramsPromise: Promise<Record<string, string>>
): Promise<z.infer<T>> {
  const params = await paramsPromise;
  return schema.parse(params);
}

export function parseQuery<T extends ZodTypeAny>(schema: T, url: string): z.infer<T> {
  const search = new URL(url).searchParams;
  return schema.parse(Object.fromEntries(search.entries()));
}

export async function parseJson<T extends ZodTypeAny>(schema: T, req: Request): Promise<z.infer<T>> {
  const body = await req.json().catch(() => ({}));
  return schema.parse(body);
}
