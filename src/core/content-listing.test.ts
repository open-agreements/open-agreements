import { describe, expect } from 'vitest';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';
import {
  DOC_CONTENT_TYPES,
  findDocContentItem,
  listDocContentItems,
  listDocContentTypesAvailable,
} from './content-listing.js';

const it = itAllure.epic('Discovery & Metadata');

const CONTENT_ID_PATTERN = /^(practice_guide|checklist|survey)(\/[a-z0-9][a-z0-9-]*){2,}$/;

describe('content-listing', () => {
  it('reports all three markdown content types available in the repo checkout', () => {
    expect(listDocContentTypesAvailable()).toEqual(['practice_guide', 'checklist', 'survey']);
  });

  it('lists documents for every type with stable ids in deterministic order', () => {
    const items = listDocContentItems();
    expect(items.length).toBeGreaterThan(100);

    const ids = items.map((item) => item.content_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort((a, b) => a.localeCompare(b))).toEqual(ids);

    const seenTypes = new Set(items.map((item) => item.type));
    for (const type of DOC_CONTENT_TYPES) {
      expect(seenTypes.has(type)).toBe(true);
    }

    for (const item of items) {
      expect(item.content_id).toMatch(CONTENT_ID_PATTERN);
      expect(item.content_id.startsWith(`${item.type}/${item.topic}/`)).toBe(true);
      expect(item.format).toBe('markdown');
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.repo_path.endsWith('.md')).toBe(true);
      // Navigation and changelog scaffolding never surfaces as content.
      expect(item.repo_path.endsWith('/index.md')).toBe(false);
      expect(item.repo_path.endsWith('/log.md')).toBe(false);
    }
  });

  it('extracts frontmatter metadata for a known practice guide', () => {
    const items = listDocContentItems();
    const guide = items.find((item) => item.content_id === 'practice_guide/wage-and-hour/us');
    expect(guide).toBeDefined();
    expect(guide?.title).toContain('Wage and Hour Law');
    expect(guide?.description).toBeTruthy();
    expect(guide?.topic).toBe('wage-and-hour');
    expect(guide?.jurisdiction).toBe('us');
    expect(guide?.source_url).toBe('https://openagreements.org/practice-guides/wage-and-hour/us');
    expect(guide?.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(guide?.tags).toContain('wage-and-hour');
    expect(guide?.repo_path).toBe('practice-guides/wage-and-hour/us.md');
  });

  it('derives nested jurisdictions and leaves non-jurisdictional docs null', () => {
    const items = listDocContentItems();
    const california = items.find(
      (item) => item.content_id === 'practice_guide/wage-and-hour/us/california',
    );
    expect(california?.jurisdiction).toBe('us/california');

    const checklist = items.find(
      (item) => item.content_id === 'checklist/safes/yc-post-money-safe-valuation-cap',
    );
    expect(checklist).toBeDefined();
    expect(checklist?.jurisdiction).toBeNull();
  });

  it('round-trips a listed item through findDocContentItem with full markdown', () => {
    const [first] = listDocContentItems();
    const detail = findDocContentItem(first.content_id);
    expect(detail).toBeDefined();
    expect(detail?.content_id).toBe(first.content_id);
    expect(detail?.title).toBe(first.title);
    expect(detail?.markdown.length).toBeGreaterThan(0);
    expect(detail?.markdown).toContain(detail?.title ?? '');
  });

  it('rejects traversal, malformed, and unknown ids', () => {
    const badIds = [
      'practice_guide/../templates/x',
      'practice_guide/wage-and-hour/../../../etc/passwd',
      'practice_guide/wage-and-hour', // missing document segment
      'practice_guide/Wage-And-Hour/us', // uppercase segments never match
      'checklist/safes/index',
      'checklist/safes/log',
      'template/common-paper-mutual-nda', // templates are not doc content
      'survey/no-such-topic/us',
      '',
    ];
    for (const contentId of badIds) {
      expect(findDocContentItem(contentId)).toBeUndefined();
    }
  });

  it('treats a missing content root as no available types and zero items', () => {
    expect(listDocContentTypesAvailable('/nonexistent/content-root')).toEqual([]);
    expect(listDocContentItems('/nonexistent/content-root')).toEqual([]);
    expect(findDocContentItem('practice_guide/wage-and-hour/us', '/nonexistent/content-root')).toBeUndefined();
  });
});
