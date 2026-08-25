/**
 * Behavioural tests for the derived-artifact patch gatekeeper.
 *
 * This script is the trust boundary of the self-heal split: everything it
 * accepts gets applied and pushed by a privileged job. So the cases that matter
 * most are the refusals. Each drives the real script end to end and asserts on
 * the exit code, against this repo's actual allowlist.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const validator = join(repoRoot, "scripts", "validate_derived_patch.mjs");

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "derived-patch-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Run the validator over `body`; return { code, output }. */
function validate(body) {
  const file = join(dir, "derived.patch");
  writeFileSync(file, body);
  try {
    const output = execFileSync(process.execPath, [validator, file], {
      encoding: "utf-8",
      stdio: "pipe",
    });
    return { code: 0, output };
  } catch (error) {
    return { code: error.status ?? 1, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

/** A minimal well-formed single-file diff. */
function diffFor(path) {
  return [
    `diff --git a/${path} b/${path}`,
    "index 1111111..2222222 100644",
    `--- a/${path}`,
    `+++ b/${path}`,
    "@@ -1 +1 @@",
    "-old",
    "+new",
    "",
  ].join("\n");
}

describe("derived patch gatekeeper", () => {
  it("accepts a patch confined to a registered path", () => {
    const result = validate(diffFor("README.md"));
    expect(result.code).toBe(0);
    expect(result.output).toContain("Patch accepted");
  });

  it("accepts a file nested under a registered directory", () => {
    const result = validate(diffFor("plugins/open-agreements/skills/x/content/ohio.md"));
    expect(result.code).toBe(0);
  });

  it("refuses a patch that touches source outside the registry", () => {
    const result = validate(diffFor("src/core/engine.ts"));
    expect(result.code).toBe(1);
    expect(result.output).toContain("unregistered path");
  });

  it("refuses a patch that rewrites a workflow", () => {
    const result = validate(diffFor(".github/workflows/ci.yml"));
    expect(result.code).toBe(1);
  });

  // The prefix test must not let a registered directory name be stretched into
  // a sibling that merely starts with the same characters.
  it("refuses a sibling path that only shares a registered prefix", () => {
    const result = validate(diffFor("plugins/open-agreements-evil/payload.md"));
    expect(result.code).toBe(1);
    expect(result.output).toContain("unregistered path");
  });

  it("refuses path traversal", () => {
    const result = validate(diffFor("README.md/../../../../etc/passwd"));
    expect(result.code).toBe(1);
  });

  it("refuses an absolute path", () => {
    const body = [
      "diff --git a//etc/passwd b//etc/passwd",
      "--- a//etc/passwd",
      "+++ b//etc/passwd",
      "@@ -1 +1 @@",
      "-x",
      "+y",
      "",
    ].join("\n");
    expect(validate(body).code).toBe(1);
  });

  it("refuses a symlink", () => {
    const body = [
      "diff --git a/llms.txt b/llms.txt",
      "new file mode 120000",
      "--- /dev/null",
      "+++ b/llms.txt",
      "@@ -0,0 +1 @@",
      "+/etc/passwd",
      "",
    ].join("\n");
    const result = validate(body);
    expect(result.code).toBe(1);
    expect(result.output).toContain("symlink");
  });

  it("refuses a rename whose destination escapes the registry", () => {
    const body = [
      "diff --git a/llms.txt b/llms.txt",
      "similarity index 100%",
      "rename from llms.txt",
      "rename to src/core/engine.ts",
      "",
    ].join("\n");
    expect(validate(body).code).toBe(1);
  });

  it("refuses an empty patch", () => {
    const result = validate("");
    expect(result.code).toBe(1);
    expect(result.output).toContain("empty");
  });

  it("refuses a patch with no file diffs at all", () => {
    const result = validate("just some prose, no diff headers\n");
    expect(result.code).toBe(1);
    expect(result.output).toContain("no file diffs");
  });

  // One good path does not launder a bad one in the same patch.
  it("refuses a mixed patch containing one unregistered file", () => {
    const result = validate(diffFor("llms.txt") + diffFor("package.json"));
    expect(result.code).toBe(1);
  });
});
