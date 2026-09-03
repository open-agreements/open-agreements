import fs from 'node:fs';
import path from 'node:path';
import {describe, expect} from 'vitest';

import {itAllure} from '../../integration-tests/helpers/allure-test.js';

const ADR_PATH = path.resolve(
  process.cwd(),
  'docs/architecture-decisions/0001-open-counsel-custody-and-content-lineage.md',
);
const it = itAllure.epic('Open Counsel').withLabels({feature: 'Architecture'});

describe('Open Counsel architecture decision', () => {
  const adr = fs.readFileSync(ADR_PATH, 'utf8');

  it('pins the runtime-neutral provider and authorization boundaries', () => {
    for (const invariant of [
      '`packages/open-counsel`',
      '`CatalogProvider`',
      '`StateProvider`',
      '`PrincipalResolver`',
      '`AuthorizationPolicy`',
      'authorizes access before search results',
    ]) {
      expect(adr).toContain(invariant);
    }
  });

  it('keeps company state caller-owned and excludes hosted dependencies', () => {
    expect(adr).toContain('Installing Open Counsel does not transmit that state to');
    expect(adr).toContain('hosted Open Counsel state');
    expect(adr).toContain('live `~/Matters` access');
    expect(adr).toContain('Vanta tenant access');
  });

  it('defines the first release and prohibits consequential core actions', () => {
    expect(adr).toContain('benchmarking substrate plus the Working');
    expect(adr).toContain('send, sign, hire, run payroll, file with a government, issue');
    expect(adr).toContain('Missing, stale, or hash-mismatched content stops');
  });
});
