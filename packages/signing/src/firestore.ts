/**
 * Thin loader for @google-cloud/firestore.
 *
 * Kept inside the signing workspace so that only packages/signing/package.json
 * declares @google-cloud/firestore as a dependency. Callers at the api/ layer
 * use this helper instead of bare-importing @google-cloud/firestore directly,
 * which would create a phantom dependency on the root package.
 *
 * See openspec/project.md (Publishing guardrail): runtime dependencies must
 * be declared explicitly by the package that imports them — no hoist-reliance.
 */

import type { Firestore as FirestoreType } from '@google-cloud/firestore';

export type Firestore = FirestoreType;

/**
 * Dynamically load the Firestore constructor from @google-cloud/firestore.
 *
 * Using a dynamic import keeps the GCP SDK out of any eager import graph —
 * the module only resolves when a hosted signing endpoint actually calls
 * this helper.
 */
export async function loadFirestore(): Promise<typeof FirestoreType> {
  const { Firestore } = await import('@google-cloud/firestore');
  return Firestore;
}
