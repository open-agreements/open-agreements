/**
 * Shared lazy Firestore getter for all auth endpoints.
 *
 * Routes Firestore loading through packages/signing/src/firestore.js so that
 * @google-cloud/firestore is only declared as a dependency in
 * packages/signing/package.json — never in the root package.json — and the
 * root CLI tarball never pulls the GCP SDKs. See openspec/project.md
 * "Publishing guardrail" for why phantom root deps are forbidden.
 */

let _db: FirebaseFirestore.Firestore | null = null;

export async function getDb(): Promise<FirebaseFirestore.Firestore> {
  if (_db) return _db;
  const { loadFirestore } = await import('../../packages/signing/src/firestore.js');
  const Firestore = await loadFirestore();
  const projectId = (process.env.GCP_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'open-agreements').trim();

  // Use explicit credentials from env if available (Vercel serverless)
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
  let credentials: { client_email: string; private_key: string } | undefined;
  if (credentialsJson) {
    try { credentials = JSON.parse(credentialsJson); } catch { /* ADC fallback */ }
  }

  _db = new Firestore({ projectId, ...(credentials ? { credentials } : {}) });
  return _db;
}
