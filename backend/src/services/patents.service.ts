import axios from "axios";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import type { PatentSource } from "../models/ResearchProject";
import { cleanText, userAgent, type SourceReport } from "./scholar.service";

/**
 * Prior-art PATENT search.
 *
 *   Google Patents — the same JSON endpoint its own search page calls. Free
 *                    and keyless, and it hands back a first-page drawing
 *                    thumbnail + PDF per patent, which is what the learner
 *                    sees in the UI. Unofficial, so it is parsed defensively
 *                    and allowed to fail.
 *   PatentsView    — USPTO's official PatentSearch API (free key). Used as a
 *                    second source when PATENTSVIEW_API_KEY is set.
 *
 * Whatever happens, the project also carries a "search this yourself" link
 * so the learner is never left without a way to the primary source.
 */

export interface PatentHit {
  source: PatentSource;
  patentNumber: string;
  title: string;
  assignee?: string;
  inventors: string[];
  filingDate?: string;
  publicationDate?: string;
  abstract?: string;
  url: string;
  pdfUrl?: string;
  thumbnailUrl?: string;
  queryRank: number;
}

export interface PatentSearchResult {
  patents: PatentHit[];
  reports: SourceReport[];
}

const PER_SOURCE_LIMIT = 8;
const MAX_QUERIES = 2;
const PATENT_IMAGES_BASE = "https://patentimages.storage.googleapis.com/";

const http = axios.create({
  timeout: 20_000,
  headers: {
    // Google Patents answers its JSON endpoint for browser-like clients only.
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://patents.google.com/",
  },
  validateStatus: () => true,
});

export function googlePatentsSearchUrl(query: string): string {
  return `https://patents.google.com/?q=${encodeURIComponent(`(${query})`)}&oq=${encodeURIComponent(query)}`;
}

export function patentLandingUrl(publicationNumber: string): string {
  return `https://patents.google.com/patent/${encodeURIComponent(publicationNumber)}/en`;
}

function normalisePublicationNumber(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const number = value.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z]{2}[A-Z0-9]{4,}$/.test(number) ? number : undefined;
}

function assetUrl(relative: string | undefined | null): string | undefined {
  if (!relative || typeof relative !== "string") return undefined;
  if (/^https?:\/\//.test(relative)) return relative;
  return `${PATENT_IMAGES_BASE}${relative.replace(/^\/+/, "")}`;
}

function splitPeople(value: string | string[] | undefined | null): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : value.split(/,\s*(?=[A-Z])|;\s*/);
  return list.map((v) => cleanText(String(v), 80) ?? "").filter(Boolean).slice(0, 8);
}

// ── Google Patents ──────────────────────────────────────────────────────────

interface GooglePatentRecord {
  publication_number?: string;
  title?: string;
  snippet?: string;
  priority_date?: string;
  filing_date?: string;
  grant_date?: string;
  publication_date?: string;
  inventor?: string | string[];
  assignee?: string | string[];
  pdf?: string;
  thumbnail?: string;
}

/** Walks the (undocumented) response for any `{ patent: {...} }` objects, wherever they sit. */
function collectPatentRecords(node: unknown, out: GooglePatentRecord[], depth = 0): void {
  if (!node || typeof node !== "object" || depth > 8) return;
  if (Array.isArray(node)) {
    for (const item of node) collectPatentRecords(item, out, depth + 1);
    return;
  }
  const record = node as Record<string, unknown>;
  if (record.patent && typeof record.patent === "object") {
    out.push(record.patent as GooglePatentRecord);
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") collectPatentRecords(value, out, depth + 1);
  }
}

async function searchGooglePatents(query: string, queryRank: number): Promise<PatentHit[]> {
  const inner = `q=${encodeURIComponent(`(${query})`)}&num=${PER_SOURCE_LIMIT}&oq=${encodeURIComponent(query)}`;
  const url = `https://patents.google.com/xhr/query?url=${encodeURIComponent(inner)}&exp=`;
  const response = await http.get<unknown>(url);
  if (response.status === 429) throw new Error("Google Patents rate limit");
  if (response.status !== 200) throw new Error(`Google Patents responded ${response.status}`);

  const body = typeof response.data === "string" ? safeJson(response.data) : response.data;
  const records: GooglePatentRecord[] = [];
  collectPatentRecords(body, records);

  const seen = new Set<string>();
  const hits: PatentHit[] = [];
  for (const record of records) {
    const number = normalisePublicationNumber(record.publication_number);
    const title = cleanText(record.title, 240);
    if (!number || !title || seen.has(number)) continue;
    seen.add(number);
    hits.push({
      source: "google_patents",
      patentNumber: number,
      title,
      assignee: splitPeople(record.assignee)[0],
      inventors: splitPeople(record.inventor),
      filingDate: record.filing_date || record.priority_date || undefined,
      publicationDate: record.grant_date || record.publication_date || undefined,
      abstract: cleanText(record.snippet, 900),
      url: patentLandingUrl(number),
      pdfUrl: assetUrl(record.pdf),
      thumbnailUrl: assetUrl(record.thumbnail),
      queryRank,
    });
  }
  return hits;
}

function safeJson(raw: string): unknown {
  try {
    // Google occasionally prefixes an anti-hijack token like ")]}'\n".
    return JSON.parse(raw.replace(/^\)\]\}'\s*/, ""));
  } catch {
    return null;
  }
}

// ── PatentsView (USPTO) ─────────────────────────────────────────────────────

interface PatentsViewRecord {
  patent_id?: string;
  patent_title?: string;
  patent_abstract?: string;
  patent_date?: string;
  assignees?: { assignee_organization?: string | null }[];
  inventors?: { inventor_name_first?: string | null; inventor_name_last?: string | null }[];
}

async function searchPatentsView(query: string, queryRank: number): Promise<PatentHit[]> {
  const response = await http.post<{ patents?: PatentsViewRecord[]; error?: boolean }>(
    "https://search.patentsview.org/api/v1/patent/",
    {
      q: { _or: [{ _text_any: { patent_title: query } }, { _text_any: { patent_abstract: query } }] },
      f: [
        "patent_id",
        "patent_title",
        "patent_abstract",
        "patent_date",
        "assignees.assignee_organization",
        "inventors.inventor_name_first",
        "inventors.inventor_name_last",
      ],
      o: { size: PER_SOURCE_LIMIT },
      s: [{ patent_date: "desc" }],
    },
    { headers: { "X-Api-Key": env.PATENTSVIEW_API_KEY, "Content-Type": "application/json" } }
  );
  if (response.status !== 200 || response.data?.error) {
    throw new Error(`PatentsView responded ${response.status}`);
  }

  return (response.data.patents ?? []).flatMap((record): PatentHit[] => {
    const title = cleanText(record.patent_title, 240);
    const id = record.patent_id?.trim();
    if (!title || !id) return [];
    const number = `US${id.toUpperCase()}`;
    return [
      {
        source: "patentsview",
        patentNumber: number,
        title,
        assignee: record.assignees?.[0]?.assignee_organization?.trim() || undefined,
        inventors: (record.inventors ?? [])
          .map((i) => [i.inventor_name_first, i.inventor_name_last].filter(Boolean).join(" ").trim())
          .filter(Boolean)
          .slice(0, 8),
        publicationDate: record.patent_date ?? undefined,
        abstract: cleanText(record.patent_abstract, 900),
        url: patentLandingUrl(number),
        queryRank,
      },
    ];
  });
}

// ── Orchestration ───────────────────────────────────────────────────────────

export async function searchPatents(queries: string[], limit = 6): Promise<PatentSearchResult> {
  const activeQueries = queries.map((q) => q.trim()).filter(Boolean).slice(0, MAX_QUERIES);
  const reports: SourceReport[] = [];
  const merged = new Map<string, PatentHit>();

  const runSource = async (name: string, search: (query: string, rank: number) => Promise<PatentHit[]>) => {
    let count = 0;
    let failure: string | undefined;
    for (const [rank, query] of activeQueries.entries()) {
      try {
        const hits = await search(query, rank);
        count += hits.length;
        for (const hit of hits) {
          const existing = merged.get(hit.patentNumber);
          if (!existing) merged.set(hit.patentNumber, hit);
          else {
            merged.set(hit.patentNumber, {
              ...existing,
              abstract: existing.abstract ?? hit.abstract,
              pdfUrl: existing.pdfUrl ?? hit.pdfUrl,
              thumbnailUrl: existing.thumbnailUrl ?? hit.thumbnailUrl,
              queryRank: Math.min(existing.queryRank, hit.queryRank),
            });
          }
        }
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
        logger.warn(`${name} search failed for "${query}"`, { error: failure });
        if (/rate limit|429/i.test(failure)) break;
      }
    }
    reports.push({ name, ok: count > 0 || !failure, count, note: failure });
  };

  const sources: Promise<void>[] = [runSource("Google Patents", searchGooglePatents)];
  if (env.PATENTSVIEW_API_KEY) sources.push(runSource("USPTO PatentsView", searchPatentsView));
  await Promise.all(sources);

  const patents = [...merged.values()]
    .sort((a, b) => {
      if (a.queryRank !== b.queryRank) return a.queryRank - b.queryRank;
      // Prefer entries we can actually show a page of.
      const aVisual = a.thumbnailUrl || a.pdfUrl ? 1 : 0;
      const bVisual = b.thumbnailUrl || b.pdfUrl ? 1 : 0;
      return bVisual - aVisual;
    })
    .slice(0, limit);

  return { patents, reports };
}
