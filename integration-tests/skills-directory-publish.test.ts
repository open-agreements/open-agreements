/**
 * Skills directory publish scenario bindings.
 *
 * The skills-directory publish flow is implemented as a manual GitHub Actions
 * workflow plus a repo script, not as a vitest-exercised runtime path. These
 * pending bindings document the scenario IDs until dedicated test coverage
 * exists.
 */

import { describe } from 'vitest';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('Platform & Distribution');

describe('skills directory publish workflow', () => {
  it
    .openspec('OA-DST-073')
    .skip(
      'No automated coverage yet. scripts/publish_skills_directories.mjs implements `scope=changed` via `git diff <base_ref>...HEAD`, but no vitest or workflow test executes the squash-merge changed-skill publish path.',
      () => {},
    );

  it
    .openspec('OA-DST-074')
    .skip(
      'No automated coverage yet. scripts/publish_skills_directories.mjs resolves `scope=selected` and rejects unknown skill names with an "Unknown selected skill(s)" error, but: (a) no test asserts subset selection, and (b) the script does not currently distinguish "directory does not exist" from "directory exists but lacks SKILL.md" — both fall through the same Unknown-skill path. The canonical scenario\'s "lacks a SKILL.md" branch is therefore partially implemented; tightening either the script or the scenario is a future follow-up.',
      () => {},
    );

  it
    .openspec('OA-DST-075')
    .skip(
      'No automated coverage yet. scripts/publish_skills_directories.mjs reads `metadata.version` from each `SKILL.md` and passes it to `clawhub publish --version`, but no test inspects the constructed publish command.',
      () => {},
    );

  it
    .openspec('OA-DST-076')
    .skip(
      'No automated coverage yet. The workflow and release docs currently automate only Smithery and ClawHub and describe `skills.sh` as discovery-only, but no test locks that policy.',
      () => {},
    );

  it
    .openspec('OA-DST-077')
    .skip(
      'Implemented only in the manual GitHub Actions workflow (.github/workflows/publish-skills-directories.yml). Missing-secret gating depends on Actions secrets and has no vitest coverage.',
      () => {},
    );
});
