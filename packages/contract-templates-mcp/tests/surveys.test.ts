import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { dispatchMessage } from '../src/core/server.js';
import {
  _resetSurveyState,
  _setFetchOverride,
  fetchSurveyEvidence,
  listPublishedSurveys,
  listSurveyResources,
  parseFormsSurveysSection,
  readSurveyResource,
  topicFromResourceUri,
} from '../src/core/surveys.js';
import { callTool } from '../src/core/tools.js';

const it = itAllure.epic('Platform & Distribution');

const EVIDENCE_URL = (topic: string) => `https://openagreements.org/api/surveys/${topic}/forms-evidence`;

// Mirrors the live llms.txt shape: "## Forms Surveys" entries link both the
// HTML survey page and the JSON evidence endpoint. `secret-benchmark` is
// deliberately absent — it stands in for an unlisted survey that upstream
// keeps reachable by direct URL but advertises nowhere.
const LLMS_TXT_FIXTURE = [
  '# OpenAgreements',
  '',
  '## Templates',
  '- [Some Template](https://openagreements.org/templates/some-template)',
  '',
  '## Forms Surveys',
  `- [Employee offer letters, compared clause by clause](https://openagreements.org/surveys/employment-offer-letter/forms) — clause-by-clause market benchmark: [HTML](https://openagreements.org/surveys/employment-offer-letter/forms), [JSON evidence](${EVIDENCE_URL('employment-offer-letter')})`,
  `- [Employee restrictive covenants](https://openagreements.org/surveys/restrictive-covenant/forms) — clause-by-clause market benchmark: [HTML](https://openagreements.org/surveys/restrictive-covenant/forms), [JSON evidence](${EVIDENCE_URL('restrictive-covenant')})`,
  '',
  '## Something Else',
  `- [Decoy entry](${EVIDENCE_URL('decoy-survey')})`,
].join('\n');

const OFFER_LETTER_PAYLOAD = {
  type: 'forms-provider-survey-evidence',
  slug: 'employment-offer-letter',
  asOf: '2026-06-30',
  sample: { prevalenceUnit: 'form', formCount: 3 },
  evidenceCellCount: 2,
  requirements: [
    { id: 'position-and-title', label: 'Position / title stated' },
    { id: 'at-will', label: 'At-will employment stated', valueType: 'boolean' },
  ],
  forms: [
    { id: 'openagreements', name: 'OpenAgreements', sourceUrl: 'https://openagreements.org/templates/openagreements-employment-offer-letter' },
  ],
  cells: {
    'position-and-title': {
      openagreements: {
        sentence: 'Employee will join Company in the position listed in Cover Terms.',
        operative: 'the position listed in Cover Terms',
        truncated: false,
        sectionName: 'Position, Scope, and Reporting',
        sectionOutlineLabel: null,
        clauseId: 'position-scope-and-reporting',
      },
    },
    'at-will': {
      openagreements: {
        sentence: 'Employment with Company is at will.',
        operative: 'at will',
        truncated: false,
        sectionName: 'At-Will Employment',
        sectionOutlineLabel: null,
        clauseId: 'at-will-employment',
      },
    },
  },
};

// The unlisted survey: reachable at its direct URL upstream (200), but absent
// from the published listing. The MCP surface must not expose it.
const UNLISTED_PAYLOAD = {
  ...OFFER_LETTER_PAYLOAD,
  slug: 'secret-benchmark',
};

interface MockRoute {
  status: number;
  body: string;
}

function installMockFetch(routes: Record<string, MockRoute>): string[] {
  const requested: string[] = [];
  _setFetchOverride(async (url) => {
    requested.push(url);
    const route = routes[url];
    if (!route) {
      return { ok: false, status: 404, text: async () => '{"error":"Survey not found"}' };
    }
    return { ok: route.status === 200, status: route.status, text: async () => route.body };
  });
  return requested;
}

function standardRoutes(): Record<string, MockRoute> {
  return {
    'https://openagreements.org/llms.txt': { status: 200, body: LLMS_TXT_FIXTURE },
    [EVIDENCE_URL('employment-offer-letter')]: { status: 200, body: JSON.stringify(OFFER_LETTER_PAYLOAD) },
    [EVIDENCE_URL('restrictive-covenant')]: { status: 200, body: JSON.stringify({ ...OFFER_LETTER_PAYLOAD, slug: 'restrictive-covenant' }) },
    [EVIDENCE_URL('secret-benchmark')]: { status: 200, body: JSON.stringify(UNLISTED_PAYLOAD) },
  };
}

afterEach(() => {
  _resetSurveyState();
});

describe('forms-survey listing parser', () => {
  it('parses only the Forms Surveys section of llms.txt', () => {
    const { headingFound, surveys } = parseFormsSurveysSection(LLMS_TXT_FIXTURE);
    expect(headingFound).toBe(true);
    expect(surveys.map((s) => s.topic)).toEqual(['employment-offer-letter', 'restrictive-covenant']);
    expect(surveys[0].title).toBe('Employee offer letters, compared clause by clause');
    expect(surveys[0].uri).toBe(EVIDENCE_URL('employment-offer-letter'));
    // The decoy under "## Something Else" must not leak into the listing.
    expect(surveys.some((s) => s.topic === 'decoy-survey')).toBe(false);
  });

  it('parses CRLF-terminated llms.txt identically', () => {
    const { surveys } = parseFormsSurveysSection(LLMS_TXT_FIXTURE.replace(/\n/g, '\r\n'));
    expect(surveys.map((s) => s.topic)).toEqual(['employment-offer-letter', 'restrictive-covenant']);
  });

  it('distinguishes a missing heading from an intentionally empty section', () => {
    const missing = parseFormsSurveysSection('# OpenAgreements\n\n## Templates\n- [T](https://openagreements.org/templates/t)\n');
    expect(missing.headingFound).toBe(false);
    expect(missing.surveys).toEqual([]);

    const empty = parseFormsSurveysSection('## Forms Surveys\n\n## Templates\n');
    expect(empty.headingFound).toBe(true);
    expect(empty.entryLineCount).toBe(0);
    expect(empty.surveys).toEqual([]);

    const malformed = parseFormsSurveysSection('## Forms Surveys\n- Employee offer letters (format changed, no links)\n');
    expect(malformed.headingFound).toBe(true);
    expect(malformed.entryLineCount).toBe(1);
    expect(malformed.surveys).toEqual([]);
  });

  it('extracts topics only from exact evidence URIs', () => {
    expect(topicFromResourceUri(EVIDENCE_URL('privacy-policy'))).toBe('privacy-policy');
    expect(topicFromResourceUri('https://openagreements.org/surveys/privacy-policy/forms')).toBeNull();
    expect(topicFromResourceUri('https://evil.example/api/surveys/privacy-policy/forms-evidence')).toBeNull();
    expect(topicFromResourceUri(`${EVIDENCE_URL('privacy-policy')}/extra`)).toBeNull();
  });
});

describe('survey resources', () => {
  it('lists one resource per published survey with asOf guidance', async () => {
    installMockFetch(standardRoutes());
    const resources = await listSurveyResources();

    expect(resources).toHaveLength(2);
    expect(resources[0]).toMatchObject({
      uri: EVIDENCE_URL('employment-offer-letter'),
      name: 'forms-survey-evidence:employment-offer-letter',
      mimeType: 'application/json',
    });
    expect(resources[0].title).toContain('Employee offer letters');
    expect(resources[0].description).toContain('asOf');
  });

  it('caches the published listing between calls', async () => {
    const requested = installMockFetch(standardRoutes());
    await listPublishedSurveys();
    await listPublishedSurveys();
    expect(requested.filter((url) => url.endsWith('/llms.txt'))).toHaveLength(1);
  });

  it('deduplicates concurrent cold listing fetches', async () => {
    const requested = installMockFetch(standardRoutes());
    const [a, b, c] = await Promise.all([listPublishedSurveys(), listPublishedSurveys(), listPublishedSurveys()]);
    expect(requested.filter((url) => url.endsWith('/llms.txt'))).toHaveLength(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('does not cache a failed listing fetch — retries are possible', async () => {
    const routes = standardRoutes();
    routes['https://openagreements.org/llms.txt'] = { status: 503, body: 'down' };
    const requested = installMockFetch(routes);
    await expect(listPublishedSurveys()).rejects.toThrow('503');

    // Restore upstream; the next call must refetch and succeed.
    routes['https://openagreements.org/llms.txt'] = { status: 200, body: LLMS_TXT_FIXTURE };
    const surveys = await listPublishedSurveys();
    expect(surveys).toHaveLength(2);
    expect(requested.filter((url) => url.endsWith('/llms.txt'))).toHaveLength(2);
  });

  it('treats a missing Forms Surveys section as an upstream failure, not an empty catalog', async () => {
    const routes = standardRoutes();
    routes['https://openagreements.org/llms.txt'] = { status: 200, body: '## Templates\n- [T](https://openagreements.org/templates/t)\n' };
    installMockFetch(routes);
    await expect(listPublishedSurveys()).rejects.toThrow('Forms Surveys');
  });

  it('treats unparseable Forms Surveys entries as an upstream failure', async () => {
    const routes = standardRoutes();
    routes['https://openagreements.org/llms.txt'] = { status: 200, body: '## Forms Surveys\n- Employee offer letters (no links anymore)\n' };
    installMockFetch(routes);
    await expect(listPublishedSurveys()).rejects.toThrow('no longer parse');
  });

  it('accepts a present-but-empty Forms Surveys section as a valid empty catalog', async () => {
    const routes = standardRoutes();
    routes['https://openagreements.org/llms.txt'] = { status: 200, body: '## Forms Surveys\n\n## Templates\n' };
    installMockFetch(routes);
    await expect(listPublishedSurveys()).resolves.toEqual([]);
  });

  it('reads a published survey resource and surfaces asOf in _meta', async () => {
    installMockFetch(standardRoutes());
    const contents = await readSurveyResource(EVIDENCE_URL('employment-offer-letter'));

    expect(contents).not.toBeNull();
    expect(contents?.mimeType).toBe('application/json');
    expect(contents?._meta).toEqual({ asOf: '2026-06-30' });
    const parsed = JSON.parse(contents?.text ?? '');
    expect(parsed.slug).toBe('employment-offer-letter');
    expect(parsed.asOf).toBe('2026-06-30');
    expect(parsed.cells['position-and-title'].openagreements.operative).toBe('the position listed in Cover Terms');
  });

  it('refuses to read an unlisted survey even though its direct URL serves 200', async () => {
    const requested = installMockFetch(standardRoutes());
    const contents = await readSurveyResource(EVIDENCE_URL('secret-benchmark'));

    expect(contents).toBeNull();
    // The gate must short-circuit before the evidence endpoint is contacted.
    expect(requested).not.toContain(EVIDENCE_URL('secret-benchmark'));
  });

  it('returns null for a survey the evidence endpoint 404s', async () => {
    const routes = standardRoutes();
    routes[EVIDENCE_URL('restrictive-covenant')] = { status: 404, body: '{"error":"Survey not found"}' };
    installMockFetch(routes);
    const contents = await readSurveyResource(EVIDENCE_URL('restrictive-covenant'));
    expect(contents).toBeNull();
  });

  it('rejects invalid topics before any evidence fetch', async () => {
    const requested = installMockFetch(standardRoutes());
    const result = await fetchSurveyEvidence('../../etc/passwd');
    expect(result.found).toBe(false);
    expect(requested).toHaveLength(0);
  });
});

describe('server resource dispatch', () => {
  it('advertises the resources capability on initialize', async () => {
    const response = await dispatchMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    const result = response?.result as { capabilities: Record<string, unknown> };
    expect(result.capabilities).toHaveProperty('tools');
    expect(result.capabilities).toHaveProperty('resources');
  });

  it('serves resources/list and resources/read end-to-end', async () => {
    installMockFetch(standardRoutes());

    const listResponse = await dispatchMessage({ jsonrpc: '2.0', id: 2, method: 'resources/list' });
    const listResult = listResponse?.result as { resources: Array<{ uri: string }> };
    expect(listResult.resources.map((r) => r.uri)).toEqual([
      EVIDENCE_URL('employment-offer-letter'),
      EVIDENCE_URL('restrictive-covenant'),
    ]);

    const readResponse = await dispatchMessage({
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/read',
      params: { uri: EVIDENCE_URL('employment-offer-letter') },
    });
    const readResult = readResponse?.result as {
      contents: Array<{ uri: string; mimeType: string; text: string; _meta?: Record<string, unknown> }>;
    };
    expect(readResult.contents).toHaveLength(1);
    expect(readResult.contents[0].uri).toBe(EVIDENCE_URL('employment-offer-letter'));
    expect(readResult.contents[0]._meta).toEqual({ asOf: '2026-06-30' });
    expect(JSON.parse(readResult.contents[0].text).evidenceCellCount).toBe(2);
  });

  it('returns -32002 for unknown and unlisted resource URIs', async () => {
    installMockFetch(standardRoutes());

    const unlisted = await dispatchMessage({
      jsonrpc: '2.0',
      id: 4,
      method: 'resources/read',
      params: { uri: EVIDENCE_URL('secret-benchmark') },
    });
    expect(unlisted?.error?.code).toBe(-32002);

    const nonSurvey = await dispatchMessage({
      jsonrpc: '2.0',
      id: 5,
      method: 'resources/read',
      params: { uri: 'https://openagreements.org/llms.txt' },
    });
    expect(nonSurvey?.error?.code).toBe(-32002);
  });

  it('rejects malformed resources/read params', async () => {
    const response = await dispatchMessage({ jsonrpc: '2.0', id: 6, method: 'resources/read', params: {} });
    expect(response?.error?.code).toBe(-32602);
  });

  it('reports listing failures as internal errors, not empty lists', async () => {
    installMockFetch({ 'https://openagreements.org/llms.txt': { status: 503, body: 'nope' } });
    const response = await dispatchMessage({ jsonrpc: '2.0', id: 7, method: 'resources/list' });
    expect(response?.error?.code).toBe(-32603);
    expect(response?.error?.message).toContain('503');
  });

  it('serves an empty resources/templates/list', async () => {
    const response = await dispatchMessage({ jsonrpc: '2.0', id: 8, method: 'resources/templates/list' });
    expect(response?.result).toEqual({ resourceTemplates: [] });
  });
});

describe('get_forms_survey_evidence tool', () => {
  function getPayload(result: Awaited<ReturnType<typeof callTool>>): Record<string, unknown> {
    return (result.structuredContent ?? {}) as Record<string, unknown>;
  }

  it('returns a summary without evidence cells by default', async () => {
    installMockFetch(standardRoutes());
    const result = await callTool('get_forms_survey_evidence', { topic: 'employment-offer-letter' });
    const payload = getPayload(result);

    expect(result.isError).toBeUndefined();
    expect(payload.ok).toBe(true);
    const data = payload.data as Record<string, unknown>;
    expect(data.as_of).toBe('2026-06-30');
    expect(data.evidence_cell_count).toBe(2);
    expect((data.requirements as unknown[]).length).toBe(2);
    expect((data.forms as unknown[]).length).toBe(1);
    expect(data.resource_uri).toBe(EVIDENCE_URL('employment-offer-letter'));
    expect(data.cells).toBeUndefined();
  });

  it('returns one requirement\'s cells when requirement_id is given', async () => {
    installMockFetch(standardRoutes());
    const result = await callTool('get_forms_survey_evidence', {
      topic: 'employment-offer-letter',
      requirement_id: 'at-will',
    });
    const data = getPayload(result).data as Record<string, unknown>;

    expect((data.requirement as Record<string, unknown>).id).toBe('at-will');
    const cells = data.cells as Record<string, Record<string, unknown>>;
    expect(cells.openagreements.operative).toBe('at will');
    // Requirement mode must not carry the whole requirements catalog.
    expect(data.requirements).toBeUndefined();
  });

  it('lists available requirement ids when requirement_id is unknown', async () => {
    installMockFetch(standardRoutes());
    const result = await callTool('get_forms_survey_evidence', {
      topic: 'employment-offer-letter',
      requirement_id: 'nonexistent',
    });
    const payload = getPayload(result);

    expect(result.isError).toBe(true);
    const error = payload.error as Record<string, unknown>;
    expect(error.code).toBe('REQUIREMENT_NOT_FOUND');
    expect(error.message).toContain('position-and-title');
  });

  it('refuses unlisted surveys with SURVEY_NOT_FOUND', async () => {
    installMockFetch(standardRoutes());
    const result = await callTool('get_forms_survey_evidence', { topic: 'secret-benchmark' });
    const payload = getPayload(result);

    expect(result.isError).toBe(true);
    expect((payload.error as Record<string, unknown>).code).toBe('SURVEY_NOT_FOUND');
  });

  it('rejects a drifted payload shape with SURVEY_FETCH_FAILED', async () => {
    const routes = standardRoutes();
    routes[EVIDENCE_URL('employment-offer-letter')] = {
      status: 200,
      // requirements drifted from objects to bare strings
      body: JSON.stringify({ ...OFFER_LETTER_PAYLOAD, requirements: ['position-and-title'] }),
    };
    installMockFetch(routes);
    const result = await callTool('get_forms_survey_evidence', { topic: 'employment-offer-letter' });
    const payload = getPayload(result);

    expect(result.isError).toBe(true);
    const error = payload.error as Record<string, unknown>;
    expect(error.code).toBe('SURVEY_FETCH_FAILED');
    expect(error.message).toContain('unexpected shape');
  });

  it('surfaces upstream fetch failures as SURVEY_FETCH_FAILED', async () => {
    const routes = standardRoutes();
    routes[EVIDENCE_URL('employment-offer-letter')] = { status: 500, body: 'server error' };
    installMockFetch(routes);
    const result = await callTool('get_forms_survey_evidence', { topic: 'employment-offer-letter' });
    const payload = getPayload(result);

    expect(result.isError).toBe(true);
    expect((payload.error as Record<string, unknown>).code).toBe('SURVEY_FETCH_FAILED');
  });
});
