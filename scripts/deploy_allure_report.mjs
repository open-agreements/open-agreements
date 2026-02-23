#!/usr/bin/env node

/**
 * Deploy the Allure report to Vercel as a static site.
 *
 * Required environment variables:
 *   VERCEL_TOKEN         – Vercel API token
 *   VERCEL_ORG_ID        – Vercel team / org ID
 *   VERCEL_PROJECT_ID    – Vercel project ID (for the allure report project)
 *
 * Usage:
 *   node scripts/deploy_allure_report.mjs
 *   node scripts/deploy_allure_report.mjs --report-dir ./allure-report
 */

import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  let reportDir = resolve(REPO_ROOT, "allure-report");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--report-dir") {
      const value = args[i + 1];
      if (!value) throw new Error("--report-dir requires a path value");
      reportDir = resolve(process.cwd(), value);
      i++;
      continue;
    }
    throw new Error(`Unknown argument: ${args[i]}`);
  }

  return { reportDir };
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function main() {
  const { reportDir } = parseArgs();

  const indexPath = resolve(reportDir, "index.html");
  if (!existsSync(indexPath)) {
    console.error(`Allure report not found at ${indexPath}`);
    console.error("Run 'npm run report:allure' first to generate the report.");
    process.exit(1);
  }

  const token = requireEnv("VERCEL_TOKEN");
  const orgId = requireEnv("VERCEL_ORG_ID");
  const projectId = requireEnv("VERCEL_PROJECT_ID");

  console.log(`Deploying Allure report from: ${reportDir}`);

  const result = execSync(
    `npx vercel deploy "${reportDir}" --prod --yes --token="${token}"`,
    {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      env: {
        ...process.env,
        VERCEL_ORG_ID: orgId,
        VERCEL_PROJECT_ID: projectId,
      },
      stdio: ["pipe", "pipe", "inherit"],
    },
  );

  const deployedUrl = result.trim().split("\n").pop();
  console.log(`Deployed to: ${deployedUrl}`);
}

main();
