/**
 * Shared lazy Firestore getter for all auth endpoints.
 */

let _db: FirebaseFirestore.Firestore | null = null;

export async function getDb(): Promise<FirebaseFirestore.Firestore> {
  if (_db) return _db;
  const { Firestore } = await import('@google-cloud/firestore');
  _db = new Firestore({
    projectId: process.env.GCP_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'open-agreements',
  });
  return _db;
}
