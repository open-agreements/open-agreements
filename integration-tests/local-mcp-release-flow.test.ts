/**
 * Local MCP release-flow scenario bindings.
 *
 * The isolated runtime smoke gate is enforced by CI's isolated-runtime-smoke
 * job via `npm run check:isolated-runtime`, not by a vitest-exercised test.
 * This pending binding documents the scenario until dedicated test-side
 * coverage exists for clean-install tarball startup checks.
 */

import { describe } from 'vitest';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('Platform & Distribution');

describe('local MCP release flow', () => {
  it
    .openspec('OA-DST-080')
    .skip(
      'Enforced by CI job "isolated-runtime-smoke" via `npm run check:isolated-runtime`. No vitest test installs packed tarballs into a clean temp directory or exercises both local MCP binaries from that isolated context yet.',
      () => {},
    );
});
