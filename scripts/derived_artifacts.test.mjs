/**
 * Behavioural tests for the derived-artifact freshness gate.
 *
 * The point of these is that the gate can actually FAIL. A drift check that
 * silently passes is worse than no check — it is how plugins/open-agreements/
 * and data/templates-snapshot.json went stale on main under a green-looking
 * job. Each case here drives scripts/derived_artifacts.mjs end to end against a
 * throwaway git repo and asserts on the exit code.
 *
 * A throwaway repo (rather than this one) keeps the suite fast and side-effect
 * free: the real generators take minutes and rewrite tracked files.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

let sandbox;

/**
 * A miniature repo whose single "projection" is derived.txt, generated from
 * source.txt by gen.mjs. Same shape as the real registry, none of the cost.
 */
function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), "derived-artifacts-"));
  const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: "pipe" });

  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");

  mkdirSync(join(dir, "scripts"));
  copyFileSync(join(repoRoot, "scripts", "derived_artifacts.mjs"), join(dir, "scripts", "derived_artifacts.mjs"));

  // Replace the real registry with a one-entry stand-in.
  const driver = join(dir, "scripts", "derived_artifacts.mjs");
  const source = execFileSync("cat", [driver], { encoding: "utf8" });
  writeFileSync(
    driver,
    source.replace(
      /const artifacts = \[[\s\S]*?\n\];/,
      `const artifacts = [{ id: "fixture", script: "scripts/gen.mjs", paths: ["derived.txt"] }];`,
    ),
  );

  writeFileSync(
    join(dir, "scripts", "gen.mjs"),
    [
      'import { readFileSync, writeFileSync } from "node:fs";',
      'import { dirname, join } from "node:path";',
      'import { fileURLToPath } from "node:url";',
      'const root = join(dirname(fileURLToPath(import.meta.url)), "..");',
      'writeFileSync(join(root, "derived.txt"), readFileSync(join(root, "source.txt"), "utf8").toUpperCase());',
    ].join("\n"),
  );

  writeFileSync(join(dir, "source.txt"), "hello\n");
  writeFileSync(join(dir, "derived.txt"), "HELLO\n");
  git("add", "-A");
  git("commit", "-qm", "fixture");
  return dir;
}

function runCheck(dir) {
  try {
    const stdout = execFileSync("node", ["scripts/derived_artifacts.mjs", "--check"], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { code: 0, output: stdout };
  } catch (error) {
    return { code: error.status, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

describe("derived-artifact freshness gate", () => {
  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  it("passes on a clean tree whose projection is current", () => {
    const { code, output } = runCheck(sandbox);
    expect(code).toBe(0);
    expect(output).toContain("current");
  });

  it("fails when a source change leaves the projection stale", () => {
    // Exactly what the sync bot does: change a source, don't regenerate.
    writeFileSync(join(sandbox, "source.txt"), "goodbye\n");
    execFileSync("git", ["commit", "-qam", "source only"], { cwd: sandbox, stdio: "pipe" });

    const { code, output } = runCheck(sandbox);
    expect(code).toBe(1);
    expect(output).toContain("stale");
    expect(output).toContain("derived.txt");
  });

  it("refuses to check when a registered path is already dirty", () => {
    // Regression: diffing porcelain before/after cannot see a further change to
    // an already-modified file, so the gate used to report "current" here.
    writeFileSync(join(sandbox, "derived.txt"), "hand-edited\n");
    writeFileSync(join(sandbox, "source.txt"), "goodbye\n");

    const { code, output } = runCheck(sandbox);
    expect(code).toBe(1);
    expect(output).toContain("uncommitted changes");
    expect(output).not.toContain("Derived artifacts are current");
  });
});
