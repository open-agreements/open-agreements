import { mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const integrationDir = dirname(fileURLToPath(import.meta.url));
const trackedOutputDir = join(integrationDir, '../testing/outputs');
const tempOutputDir = join(tmpdir(), 'safe-docx', 'docx-comparison', 'integration-outputs');
function envEnabled(name) {
    const value = process.env[name];
    if (!value)
        return false;
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}
export const WRITE_TRACKED_OUTPUT_FIXTURES = envEnabled('SDX_WRITE_OUTPUT_FIXTURES');
export const FIXTURE_STABLE_DATE = new Date('2024-01-01T00:00:00Z');
export function getIntegrationOutputDir() {
    return WRITE_TRACKED_OUTPUT_FIXTURES ? trackedOutputDir : tempOutputDir;
}
export function getIntegrationOutputModeLabel() {
    return WRITE_TRACKED_OUTPUT_FIXTURES ? 'tracked fixtures' : 'temporary outputs';
}
export async function writeIntegrationArtifact(fileName, data) {
    const outputDir = getIntegrationOutputDir();
    await mkdir(outputDir, { recursive: true });
    const outputPath = join(outputDir, fileName);
    await writeFile(outputPath, data);
    return outputPath;
}
//# sourceMappingURL=output-artifacts.js.map