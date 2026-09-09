import axios from "axios";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import type { PaperSource } from "../models/ResearchProject";

/**
 * Prior-art paper search across three FREE, keyless scholarly indexes:
 *
 *   arXiv            — preprints; every hit has an open PDF (best for snapshots)
 *   Semantic Scholar — 200M+ papers, citation counts, open-access PDF links
 *   OpenAlex         — the open successor to Microsoft Academic; broad coverage
 *
 * Each source is queried independently and is allowed to fail (rate limit,
 * outage) without taking the others down. Results are merged and de-duplicated
 * by DOI / arXiv id / normalised title, then ranked so papers that several
 * sources or queries agree on rise to the top.
 */

export interface PaperHit {
  source: PaperSource;
  externalId: string;
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  abstract?: string;
  url: string;
  pdfUrl?: string;
  doi?: string;
  citationCount?: number;
  /** Which query (0-based) produced this hit — earlier queries are the most on-topic. */
  queryRank: number;
}

export interface SourceReport {
  name: string;
  ok: boolean;
  count: number;
  note?: string;
}

export interface PaperSearchResult {
  papers: PaperHit[];
  reports: SourceReport[];
}

const PER_SOURCE_LIMIT = 8;
const MAX_QUERIES = 3;
const REQUEST_TIMEOUT_MS = 20_000;

const STOPWORDS = new Set(
  "a an the of for and or in on at to with by from into using via based towards toward about over under between within without vs versus new novel approach method study analysis system systems model models".split(
    " "
  )
);

export function userAgent(): string {
  const contact = env.RESEARCH_CONTACT_EMAIL ? ` (mailto:${env.RESEARCH_CONTACT_EMAIL})` : "";
  return `SMART-AI-ResearchLab/1.0${contact}`;
}

const http = axios.create({
  timeout: REQUEST_TIMEOUT_MS,
  headers: { "User-Agent": userAgent(), Accept: "application/json, application/atom+xml;q=0.9, */*;q=0.8" },
  validateStatus: () => true,
});

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Strips tags and collapses whitespace — abstracts arrive with markup and hard wraps. */
export function cleanText(value: string | undefined | null, max = 1_400): string | undefined {
  if (!value) return undefined;
  const text = decodeEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseDoi(doi: string | undefined | null): string | undefined {
  if (!doi) return undefined;
  return doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:/, "") || undefined;
}

/** "1706.03762v7" → "1706.03762" — versions are the same paper. */
function normaliseArxivId(id: string | undefined | null): string | undefined {
  if (!id) return undefined;
  const match = id.match(/(\d{4}\.\d{4,5}|[a-z\-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?$/i);
  return match ? match[1].toLowerCase() : undefined;
}

// ── arXiv ───────────────────────────────────────────────────────────────────

/**
 * arXiv's query language ANDs explicit terms; a bare multi-word string is
 * parsed unpredictably, so each meaningful word becomes an `all:` clause.
 */
function buildArxivQuery(query: string): string {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\- ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 5);
  if (words.length === 0) return `all:${encodeURIComponent(query.trim())}`;
  return words.map((w) => `all:${encodeURIComponent(w)}`).join("+AND+");
}

function tag(xml: string, name: string): string | undefined {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return match ? match[1] : undefined;
}

async function searchArxiv(query: string, queryRank: number): Promise<PaperHit[]> {
  const url = `https://export.arxiv.org/api/query?search_query=${buildArxivQuery(query)}&start=0&max_results=${PER_SOURCE_LIMIT}&sortBy=relevance&sortOrder=descending`;
  const response = await http.get<string>(url, { responseType: "text" });
  if (response.status !== 200 || typeof response.data !== "string") {
    throw new Error(`arXiv responded ${response.status}`);
  }

  const entries = response.data.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  const hits: PaperHit[] = [];
  for (const entry of entries) {
    const idUrl = tag(entry, "id")?.trim() ?? "";
    const arxivId = normaliseArxivId(idUrl);
    const title = cleanText(tag(entry, "title"), 300);
    if (!arxivId || !title) continue;

    const authors = (entry.match(/<author>[\s\S]*?<\/author>/g) ?? [])
      .map((a) => cleanText(tag(a, "name"), 80))
      .filter((a): a is string => Boolean(a));
    const published = tag(entry, "published");
    const year = published ? Number(published.slice(0, 4)) : undefined;
    const doi = normaliseDoi(tag(entry, "arxiv:doi"));
    const venue = cleanText(tag(entry, "arxiv:journal_ref"), 120);

    hits.push({
      source: "arxiv",
      externalId: arxivId,
      title,
      authors,
      year: Number.isFinite(year) ? year : undefined,
      venue: venue ?? "arXiv preprint",
      abstract: cleanText(tag(entry, "summary")),
      url: `https://arxiv.org/abs/${arxivId}`,
      pdfUrl: `https://arxiv.org/pdf/${arxivId}`,
      doi,
      queryRank,
    });
  }
  return hits;
}

// ── Semantic Scholar ────────────────────────────────────────────────────────

interface S2Paper {
  paperId: string;
  title?: string;
  abstract?: string | null;
  year?: number | null;
  venue?: string | null;
  citationCount?: number | null;
  url?: string;
  openAccessPdf?: { url?: string } | null;
  externalIds?: { DOI?: string; ArXiv?: string } | null;
  authors?: { name?: string }[];
}

async function searchSemanticScholar(query: string, queryRank: number): Promise<PaperHit[]> {
  const fields = "paperId,title,abstract,year,venue,citationCount,url,openAccessPdf,externalIds,authors";
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${PER_SOURCE_LIMIT}&fields=${fields}`;
  const headers: Record<string, string> = {};
  if (env.SEMANTIC_SCHOLAR_API_KEY) headers["x-api-key"] = env.SEMANTIC_SCHOLAR_API_KEY;

  const response = await http.get<{ data?: S2Paper[] }>(url, { headers });
  if (response.status === 429) throw new Error("Semantic Scholar rate limit (shared anonymous pool) — set SEMANTIC_SCHOLAR_API_KEY to lift it");
  if (response.status !== 200) throw new Error(`Semantic Scholar responded ${response.status}`);

  return (response.data?.data ?? []).flatMap((paper): PaperHit[] => {
    const title = cleanText(paper.title, 300);
    if (!title || !paper.paperId) return [];
    const arxivId = normaliseArxivId(paper.externalIds?.ArXiv);
    const pdfUrl = paper.openAccessPdf?.url || (arxivId ? `https://arxiv.org/pdf/${arxivId}` : undefined);
    return [
      {
        source: "semanticscholar",
        externalId: paper.paperId,
        title,
        authors: (paper.authors ?? []).map((a) => a.name?.trim() ?? "").filter(Boolean).slice(0, 12),
        year: paper.year ?? undefined,
        venue: cleanText(paper.venue, 120),
        abstract: cleanText(paper.abstract),
        url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
        pdfUrl,
        doi: normaliseDoi(paper.externalIds?.DOI),
        citationCount: paper.citationCount ?? undefined,
        queryRank,
      },
    ];
  });
}

// ── OpenAlex ────────────────────────────────────────────────────────────────

interface OpenAlexWork {
  id?: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  cited_by_count?: number | null;
  primary_location?: {
    landing_page_url?: string | null;
    pdf_url?: string | null;
    source?: { display_name?: string | null } | null;
  } | null;
  open_access?: { is_oa?: boolean; oa_url?: string | null } | null;
  authorships?: { author?: { display_name?: string | null } | null }[];
  abstract_inverted_index?: Record<string, number[]> | null;
  ids?: { openalex?: string } | null;
}

/** OpenAlex ships abstracts as {word: [positions]} — rebuild the sentence. */
function abstractFromInvertedIndex(index: Record<string, number[]> | null | undefined): string | undefined {
  if (!index) return undefined;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) words[position] = word;
  }
  return cleanText(words.filter(Boolean).join(" "));
}

async function searchOpenAlex(query: string, queryRank: number): Promise<PaperHit[]> {
  const select =
    "id,doi,title,display_name,publication_year,cited_by_count,primary_location,open_access,authorships,abstract_inverted_index,ids";
  const mailto = env.RESEARCH_CONTACT_EMAIL ? `&mailto=${encodeURIComponent(env.RESEARCH_CONTACT_EMAIL)}` : "";
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${PER_SOURCE_LIMIT}&select=${select}${mailto}`;

  const response = await http.get<{ results?: OpenAlexWork[] }>(url);
  if (response.status !== 200) throw new Error(`OpenAlex responded ${response.status}`);

  return (response.data?.results ?? []).flatMap((work): PaperHit[] => {
    const title = cleanText(work.title ?? work.display_name, 300);
    const openalexId = (work.ids?.openalex ?? work.id ?? "").replace(/^https?:\/\/openalex\.org\//, "");
    if (!title || !openalexId) return [];
    const doi = normaliseDoi(work.doi);
    const landing = work.primary_location?.landing_page_url || (doi ? `https://doi.org/${doi}` : `https://openalex.org/${openalexId}`);
    const pdfUrl = work.primary_location?.pdf_url || work.open_access?.oa_url || undefined;
    return [
      {
        source: "openalex",
        externalId: openalexId,
        title,
        authors: (work.authorships ?? [])
          .map((a) => a.author?.display_name?.trim() ?? "")
          .filter(Boolean)
          .slice(0, 12),
        year: work.publication_year ?? undefined,
        venue: cleanText(work.primary_location?.source?.display_name, 120),
        abstract: abstractFromInvertedIndex(work.abstract_inverted_index),
        url: landing,
        pdfUrl: pdfUrl && /^https?:\/\//.test(pdfUrl) ? pdfUrl : undefined,
        doi,
        citationCount: work.cited_by_count ?? undefined,
        queryRank,
      },
    ];
  });
}

// ── Merge + rank ────────────────────────────────────────────────────────────

interface Merged {
  hit: PaperHit;
  /** How many (source, query) pairs surfaced this paper — agreement is a strong relevance signal. */
  agreement: number;
}

function dedupeKey(hit: PaperHit): string {
  if (hit.doi) return `doi:${hit.doi}`;
  const arxivId = hit.source === "arxiv" ? hit.externalId : normaliseArxivId(hit.pdfUrl);
  if (arxivId) return `arxiv:${arxivId}`;
  return `title:${normaliseTitle(hit.title)}`;
}

/** Keeps the richest record for a paper seen from several sources. */
function mergeHits(existing: PaperHit, incoming: PaperHit): PaperHit {
  return {
    ...existing,
    // arXiv PDFs always render; prefer them for the snapshot.
    pdfUrl: existing.pdfUrl?.includes("arxiv.org") ? existing.pdfUrl : incoming.pdfUrl?.includes("arxiv.org") ? incoming.pdfUrl : existing.pdfUrl ?? incoming.pdfUrl,
    abstract: (existing.abstract?.length ?? 0) >= (incoming.abstract?.length ?? 0) ? existing.abstract : incoming.abstract,
    authors: existing.authors.length >= incoming.authors.length ? existing.authors : incoming.authors,
    year: existing.year ?? incoming.year,
    venue: existing.venue && existing.venue !== "arXiv preprint" ? existing.venue : incoming.venue ?? existing.venue,
    doi: existing.doi ?? incoming.doi,
    citationCount: Math.max(existing.citationCount ?? 0, incoming.citationCount ?? 0) || undefined,
    queryRank: Math.min(existing.queryRank, incoming.queryRank),
  };
}

function score(entry: Merged): number {
  const { hit, agreement } = entry;
  const currentYear = new Date().getFullYear();
  const recency = hit.year ? Math.max(0, 1 - (currentYear - hit.year) / 12) : 0.2;
  const citations = Math.log10((hit.citationCount ?? 0) + 1);
  const queryBonus = hit.queryRank === 0 ? 1 : hit.queryRank === 1 ? 0.5 : 0.2;
  const snapshotable = hit.pdfUrl ? 0.4 : 0;
  const hasAbstract = hit.abstract ? 0.3 : 0;
  return agreement * 2 + citations + recency + queryBonus + snapshotable + hasAbstract;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs every query against every source (in parallel across sources, gently
 * sequential within arXiv which asks for a pause between calls), then merges.
 */
export async function searchPapers(queries: string[], limit = 8): Promise<PaperSearchResult> {
  const activeQueries = queries.map((q) => q.trim()).filter(Boolean).slice(0, MAX_QUERIES);
  const reports: SourceReport[] = [];
  const merged = new Map<string, Merged>();

  const absorb = (hits: PaperHit[]) => {
    for (const hit of hits) {
      const key = dedupeKey(hit);
      const existing = merged.get(key);
      if (existing) {
        existing.hit = mergeHits(existing.hit, hit);
        existing.agreement += 1;
      } else {
        merged.set(key, { hit, agreement: 1 });
      }
    }
  };

  const runSource = async (
    name: string,
    search: (query: string, rank: number) => Promise<PaperHit[]>,
    delayBetweenMs = 0
  ) => {
    let count = 0;
    let failure: string | undefined;
    for (const [rank, query] of activeQueries.entries()) {
      try {
        const hits = await search(query, rank);
        count += hits.length;
        absorb(hits);
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
        logger.warn(`${name} search failed for "${query}"`, { error: failure });
        // A rate-limit on one query will hit the next one too — stop early.
        if (/rate limit|429/i.test(failure)) break;
      }
      if (delayBetweenMs && rank < activeQueries.length - 1) await sleep(delayBetweenMs);
    }
    reports.push({ name, ok: count > 0 || !failure, count, note: failure });
  };

  await Promise.all([
    runSource("arXiv", searchArxiv, 3_100),
    runSource("Semantic Scholar", searchSemanticScholar, 1_100),
    runSource("OpenAlex", searchOpenAlex),
  ]);

  const papers = [...merged.values()]
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit)
    .map((entry) => entry.hit);

  return { papers, reports };
}
