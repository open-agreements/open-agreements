#!/usr/bin/env node

/**
 * Allure report deployment information.
 *
 * Production deployments are handled automatically by CI via Vercel.
 * See .github/workflows/ci.yml → deploy-allure job.
 *
 * Push to main → CI deploys the generated static report to the
 * tests-openagreements Vercel project when the required GitHub Actions secrets
 * are configured:
 *   - VERCEL_TOKEN
 *   - VERCEL_ORG_ID
 *   - VERCEL_PROJECT_ID_TESTS_OPENAGREEMENTS
 *
 * The production report is served at:
 *   - https://tests.openagreements.ai
 *   - https://tests.openagreements.org
 *
 * To preview the report locally:
 *   npm run report:allure    # generates ./allure-report
 *   npx allure open allure-report
 */

console.log("Allure report deployment is handled by CI via the tests-openagreements Vercel project.");
console.log("");
console.log("Push to main → CI auto-deploys to:");
console.log("  https://tests.openagreements.ai");
console.log("  https://tests.openagreements.org");
console.log("");
console.log("Required GitHub Actions secrets:");
console.log("  VERCEL_TOKEN");
console.log("  VERCEL_ORG_ID");
console.log("  VERCEL_PROJECT_ID_TESTS_OPENAGREEMENTS");
console.log("");
console.log("To preview locally:");
console.log("  npm run report:allure");
console.log("  npx allure open allure-report");
