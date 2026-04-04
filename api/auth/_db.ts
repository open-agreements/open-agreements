/**
 * Shared lazy Firestore getter for all auth endpoints.
 */

let _db: FirebaseFirestore.Firestore | null = null;

export async function getDb(): Promise<FirebaseFirestore.Firestore> {
  if (_db) return _db;
  const { Firestore } = await import('@google-cloud/firestore');
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
