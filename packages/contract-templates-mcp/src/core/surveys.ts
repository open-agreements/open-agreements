/**
 * Forms-provider survey evidence, exposed as MCP resources (open-agreements#672).
 *
 * The datasets live on openagreements.org (served by the web property), not in
 * this repository. Two upstream surfaces matter here:
 *
 * - `GET /llms.txt` — its "## Forms Surveys" section is generated from the
 *   upstream `listPublicFormsProviderSurveys()` gate, so it enumerates exactly
 *   the surveys that are published (`unlisted: false`). This module treats that
 *   section as the authoritative live listing and NEVER hardcodes survey slugs.
 * - `GET /api/surveys/{topic}/forms-evidence` — the evidence dataset itself.
 *   NOTE: upstream intentionally keeps unlisted surveys reachable at this URL
 *   (unlisted means "unadvertised", not "blocked"), so this endpoint alone is
 *   NOT the unlisted gate. To honor the gate at read time, reads first require
 *   membership in the live listing above, then fetch the dataset.
 *
 * Both surfaces are public, unauthenticated GETs; this module adds no auth.
 */

const OPENAGREEMENTS_ORIGIN = 'https://openagreements.org';
const LLMS_TXT_URL = `${OPENAGREEMENTS_ORIGIN}/llms.txt`;
const FORMS_SURVEYS_HEADING = '## Forms Surveys';

const TOPIC_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const EVIDENCE_URI_PATTERN =
  /^https:\/\/openagreements\.org\/api\/surveys\/([a-z0-9][a-z0-9-]*)\/forms-evidence$/;

const FETCH_TIMEOUT_MS = 15_000;

// Upstream serves llms.txt through Vercel's CDN (observed
// `cache-control: public, max-age=0, must-revalidate` with CDN HITs); a short
// in-process cache just avoids refetching it for back-to-back MCP calls in
// one session. A survey newly unlisted upstream can therefore stay visible
// here for up to this TTL on top of whatever the upstream cache windows allow.
const LISTING_CACHE_TTL_MS = 60_000;

export const SURVEY_EVIDENCE_MIME_TYPE = 'application/json';

export interface SurveyDescriptor {
  topic: string;
  title: string;
  uri: string;
}

export interface SurveyResourceDescriptor {
  uri: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
}

export interface SurveyResourceContents {
  uri: string;
  mimeType: string;
  text: string;
  _meta?: Record<string, unknown>;
}

export class SurveyFetchError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'SurveyFetchError';
  }
}

type FetchLike = (url: string, init: { signal: AbortSignal; headers: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

let _fetchOverride: FetchLike | null = null;
let _listingCache: { surveys: SurveyDescriptor[]; expiresAt: number } | null = null;
let _listingInFlight: Promise<SurveyDescriptor[]> | null = null;

/** Inject a fetch implementation — for testing only. */
export function _setFetchOverride(fetchLike: FetchLike | null): void {
  _fetchOverride = fetchLike;
  _listingCache = null;
  _listingInFlight = null;
}

/** Reset cached listing state — for testing only. */
export function _resetSurveyState(): void {
  _fetchOverride = null;
  _listingCache = null;
  _listingInFlight = null;
}

async function httpGet(url: string): Promise<{ status: number; text: string }> {
  const fetchImpl: FetchLike = _fetchOverride ?? (fetch as unknown as FetchLike);
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: 'application/json, text/plain;q=0.9, */*;q=0.1' },
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new SurveyFetchError(`Failed to fetch ${url}: ${details}`);
  }
  return { status: response.status, text: await response.text() };
}

export function surveyEvidenceUrl(topic: string): string {
  return `${OPENAGREEMENTS_ORIGIN}/api/surveys/${topic}/forms-evidence`;
}

export function isValidTopic(topic: string): boolean {
  return TOPIC_PATTERN.test(topic);
}

/** Extract the survey topic from a resource URI, or null if it is not a survey-evidence URI. */
export function topicFromResourceUri(uri: string): string | null {
  const match = EVIDENCE_URI_PATTERN.exec(uri);
  return match ? match[1] : null;
}

export interface FormsSurveysParseResult {
  /** Whether the "## Forms Surveys" heading was present at all. */
  headingFound: boolean;
  /** Number of "- " list lines seen inside the section (parseable or not). */
  entryLineCount: number;
  surveys: SurveyDescriptor[];
}

/**
 * Parse the "## Forms Surveys" section of llms.txt into survey descriptors.
 * Exported for tests.
 */
export function parseFormsSurveysSection(llmsTxt: string): FormsSurveysParseResult {
  const lines = llmsTxt.split('\n');
  const surveys: SurveyDescriptor[] = [];
  const seen = new Set<string>();
  let inSection = false;
  let headingFound = false;
  let entryLineCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('## ')) {
      inSection = line === FORMS_SURVEYS_HEADING;
      headingFound = headingFound || inSection;
      continue;
    }
    if (!inSection || !line.startsWith('- ')) {
      continue;
    }
    entryLineCount += 1;

    const titleMatch = /^- \[([^\]]+)\]/.exec(line);
    const urlMatch = /\((https:\/\/openagreements\.org\/api\/surveys\/[a-z0-9-]+\/forms-evidence)\)/.exec(line);
    if (!titleMatch || !urlMatch) {
      continue;
    }
    const topic = topicFromResourceUri(urlMatch[1]);
    if (!topic || seen.has(topic)) {
      continue;
    }
    seen.add(topic);
    surveys.push({ topic, title: titleMatch[1], uri: urlMatch[1] });
  }

  return { headingFound, entryLineCount, surveys };
}

/**
 * List the currently published forms-provider surveys by reading the live,
 * upstream-gated listing. Cached briefly in-process; concurrent cold calls
 * share a single upstream fetch.
 *
 * A missing or unparseable "## Forms Surveys" section is an upstream-contract
 * failure and throws rather than caching an empty listing — otherwise a
 * formatting change upstream would silently make every survey "not found".
 * A heading that is present but intentionally empty is a valid empty listing.
 */
export async function listPublishedSurveys(): Promise<SurveyDescriptor[]> {
  if (_listingCache && _listingCache.expiresAt > Date.now()) {
    return _listingCache.surveys;
  }
  if (_listingInFlight) {
    return _listingInFlight;
  }

  _listingInFlight = (async () => {
    const { status, text } = await httpGet(LLMS_TXT_URL);
    if (status !== 200) {
      throw new SurveyFetchError(`Survey listing unavailable: ${LLMS_TXT_URL} returned HTTP ${status}`, status);
    }

    const parsed = parseFormsSurveysSection(text);
    if (!parsed.headingFound) {
      throw new SurveyFetchError(
        `Survey listing format changed: no "${FORMS_SURVEYS_HEADING}" section in ${LLMS_TXT_URL}`,
      );
    }
    if (parsed.entryLineCount > 0 && parsed.surveys.length === 0) {
      throw new SurveyFetchError(
        `Survey listing format changed: "${FORMS_SURVEYS_HEADING}" entries in ${LLMS_TXT_URL} no longer parse`,
      );
    }

    _listingCache = { surveys: parsed.surveys, expiresAt: Date.now() + LISTING_CACHE_TTL_MS };
    return parsed.surveys;
  })();

  try {
    return await _listingInFlight;
  } finally {
    _listingInFlight = null;
  }
}

/** MCP resource descriptors for resources/list. */
export async function listSurveyResources(): Promise<SurveyResourceDescriptor[]> {
  const surveys = await listPublishedSurveys();
  return surveys.map((survey) => ({
    uri: survey.uri,
    name: `forms-survey-evidence:${survey.topic}`,
    title: `${survey.title} — evidence dataset`,
    description:
      `Complete evidence dataset behind the "${survey.title}" forms survey: compared requirements, ` +
      'surveyed forms with public source URLs, and every evidence cell (verbatim sentence, operative ' +
      "phrase, section, and clause id). The payload's top-level asOf field carries the review date. " +
      'Large surveys can approach 1 MB; the get_forms_survey_evidence tool returns a summary or a ' +
      "single requirement's evidence instead.",
    mimeType: SURVEY_EVIDENCE_MIME_TYPE,
  }));
}

export interface SurveyEvidenceFetchResult {
  found: boolean;
  /** Raw JSON text of the evidence payload (present when found). */
  text?: string;
  /** Parsed payload (present when found and parseable). */
  payload?: SurveyEvidencePayload;
}

export interface SurveyEvidencePayload {
  type?: string;
  slug?: string;
  asOf?: string;
  sample?: unknown;
  evidenceCellCount?: number;
  requirements?: Array<{ id: string; label: string; valueType?: string }>;
  forms?: Array<{ id: string; name: string; sourceUrl: string }>;
  cells?: Record<string, Record<string, unknown>>;
}

/**
 * Fetch the evidence dataset for a survey, honoring the unlisted gate: the
 * topic must appear in the live published listing before the dataset is
 * fetched. Returns { found: false } for unknown or unlisted surveys.
 */
export async function fetchSurveyEvidence(topic: string): Promise<SurveyEvidenceFetchResult> {
  if (!isValidTopic(topic)) {
    return { found: false };
  }

  const published = await listPublishedSurveys();
  if (!published.some((survey) => survey.topic === topic)) {
    return { found: false };
  }

  const { status, text } = await httpGet(surveyEvidenceUrl(topic));
  if (status === 404) {
    return { found: false };
  }
  if (status !== 200) {
    throw new SurveyFetchError(`Survey evidence fetch failed: HTTP ${status} for topic "${topic}"`, status);
  }

  let payload: SurveyEvidencePayload | undefined;
  try {
    payload = JSON.parse(text) as SurveyEvidencePayload;
  } catch {
    throw new SurveyFetchError(`Survey evidence for "${topic}" is not valid JSON`);
  }

  return { found: true, text, payload };
}

/**
 * Read one survey resource for resources/read. Returns null when the URI is
 * not a survey-evidence URI or the survey is not published (unknown/unlisted).
 */
export async function readSurveyResource(uri: string): Promise<SurveyResourceContents | null> {
  const topic = topicFromResourceUri(uri);
  if (!topic) {
    return null;
  }

  const result = await fetchSurveyEvidence(topic);
  if (!result.found || result.text === undefined) {
    return null;
  }

  const asOf = result.payload?.asOf;
  return {
    uri,
    mimeType: SURVEY_EVIDENCE_MIME_TYPE,
    text: result.text,
    ...(typeof asOf === 'string' ? { _meta: { asOf } } : {}),
  };
}
