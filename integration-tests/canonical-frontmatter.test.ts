import { describe, expect, it } from 'vitest';
import {
  assertCanonicalIdentity,
  parseCanonicalFrontmatter,
  tryParseCanonicalFrontmatter,
} from '../scripts/template_renderer/canonical-frontmatter.mjs';

describe('parseCanonicalFrontmatter — YAML error contract', () => {
  it('wraps YAML parse failures with file path and preserves the original via cause', () => {
    const malformed = '---\ntemplate_id: [unclosed\n---\nbody';
    let captured: unknown;
    try {
      parseCanonicalFrontmatter(malformed, '/fake/path.md');
    } catch (err) {
      captured = err;
    }
    expect(captured).toBeInstanceOf(Error);
    const error = captured as Error & { cause?: unknown };
    expect(error.message).toMatch(/Canonical source frontmatter \(\/fake\/path\.md\) failed to parse:/);
    expect(error.cause).toBeInstanceOf(Error);
    expect(error.message).toContain((error.cause as Error).message);
  });

  it('throws when the frontmatter block is missing', () => {
    expect(() => parseCanonicalFrontmatter('no frontmatter here', '/fake/path.md'))
      .toThrowError(/must start with YAML frontmatter/);
  });

  it('throws when frontmatter is not a YAML object', () => {
    const scalar = '---\njust-a-string\n---\nbody';
    expect(() => parseCanonicalFrontmatter(scalar, '/fake/path.md'))
      .toThrowError(/must be a YAML object/);
  });
});

describe('tryParseCanonicalFrontmatter', () => {
  it('returns null on parse failure', () => {
    expect(tryParseCanonicalFrontmatter('no frontmatter here')).toBeNull();
  });

  it('returns frontmatter and body on success', () => {
    const result = tryParseCanonicalFrontmatter('---\ntemplate_id: foo\n---\nbody');
    expect(result?.frontmatter).toEqual({ template_id: 'foo' });
    expect(result?.body).toBe('body');
  });
});

describe('assertCanonicalIdentity — non-empty enforcement', () => {
  it('passes when all three fields are non-empty strings', () => {
    expect(() =>
      assertCanonicalIdentity(
        { template_id: 't', layout_id: 'l', style_id: 's' },
        '/fake.md',
      ),
    ).not.toThrow();
  });

  it('throws on an empty string with a field-specific message', () => {
    expect(() =>
      assertCanonicalIdentity(
        { template_id: '', layout_id: 'l', style_id: 's' },
        '/fake.md',
      ),
    ).toThrowError(/missing template_id/);
  });

  it('throws on a missing field', () => {
    expect(() =>
      assertCanonicalIdentity(
        { template_id: 't', layout_id: 'l' },
        '/fake.md',
      ),
    ).toThrowError(/missing style_id/);
  });
});
