import { defaultConventions } from './convention-config.js';
import { LIFECYCLE_DIRS } from './constants.js';
import type { WorkspaceProvider } from './provider.js';
import type { ConventionConfig } from './types.js';

const MIN_FILES_FOR_DETECTION = 5;
const MAJORITY_THRESHOLD = 0.6;

interface MarkerCandidate {
  pattern: string;
  location: ConventionConfig['executed_marker']['location'];
  count: number;
}

interface NamingCandidate {
  style: string;
  separator: string;
  count: number;
}

export function scanExistingConventions(provider: WorkspaceProvider): ConventionConfig {
  const defaults = defaultConventions();

  // Collect all files from root (non-recursive first level + walk subdirs)
  const allFiles = collectAllFileNames(provider);

  if (allFiles.length < MIN_FILES_FOR_DETECTION) {
    return defaults;
  }

  // Detect executed markers
  const executedMarker = detectExecutedMarker(allFiles) ?? defaults.executed_marker;

  // Detect naming style
  const naming = detectNamingStyle(allFiles) ?? defaults.naming;

  // Detect lifecycle applicability
  const { applicableDomains, assetDomains } = detectDomainApplicability(provider);

  // Build lifecycle folders map from what exists
  const folders: Record<string, string> = {};
  for (const dir of LIFECYCLE_DIRS) {
    folders[dir] = dir;
  }

  return {
    schema_version: 1,
    executed_marker: executedMarker,
    naming,
    lifecycle: {
      folders,
      applicable_domains: applicableDomains.length > 0
        ? applicableDomains
        : defaults.lifecycle.applicable_domains,
      asset_domains: assetDomains,
    },
    cross_references: defaults.cross_references,
    documentation: defaults.documentation,
  };
}

function collectAllFileNames(provider: WorkspaceProvider): string[] {
  const names: string[] = [];

  try {
    const rootEntries = provider.readdir('.');
    for (const entry of rootEntries) {
      if (entry.isDirectory) {
        const walked = provider.walk(entry.relativePath);
        for (const file of walked) {
          names.push(file.name);
        }
      } else {
        names.push(entry.name);
      }
    }
  } catch {
    // If readdir fails, return empty
  }

  return names;
}

function detectExecutedMarker(fileNames: string[]): ConventionConfig['executed_marker'] | null {
  const candidates: MarkerCandidate[] = [
    { pattern: '_executed', location: 'before_extension', count: 0 },
    { pattern: '_signed', location: 'before_extension', count: 0 },
    { pattern: '(executed)', location: 'in_parentheses', count: 0 },
    { pattern: '(fully executed)', location: 'in_parentheses', count: 0 },
    { pattern: '(signed)', location: 'in_parentheses', count: 0 },
  ];

  for (const fileName of fileNames) {
    const lower = fileName.toLowerCase();
    for (const candidate of candidates) {
      if (candidate.location === 'before_extension') {
        const withoutExt = lower.replace(/\.[^.]*$/u, '');
        if (withoutExt.endsWith(candidate.pattern)) {
          candidate.count++;
        }
      } else if (candidate.location === 'in_parentheses') {
        if (lower.includes(candidate.pattern)) {
          candidate.count++;
        }
      }
    }
  }

  const totalMarked = candidates.reduce((sum, c) => sum + c.count, 0);
  if (totalMarked === 0) {
    return null;
  }

  // Find the winner
  const sorted = [...candidates].sort((a, b) => b.count - a.count);
  const winner = sorted[0];

  if (winner.count / totalMarked < MAJORITY_THRESHOLD) {
    return null; // No clear majority
  }

  return {
    pattern: winner.pattern,
    location: winner.location,
  };
}

function detectNamingStyle(fileNames: string[]): ConventionConfig['naming'] | null {
  const candidates: NamingCandidate[] = [
    { style: 'snake_case', separator: '_', count: 0 },
    { style: 'kebab-case', separator: '-', count: 0 },
    { style: 'title-case-dash', separator: ' - ', count: 0 },
  ];

  for (const fileName of fileNames) {
    const withoutExt = fileName.replace(/\.[^.]*$/u, '');
    if (withoutExt.length < 2) continue;

    // Title case with dash separator (e.g., "NDA - Company Name")
    if (/\s-\s/.test(withoutExt)) {
      candidates[2].count++;
    }
    // Snake case (e.g., "company_nda_v2")
    else if (/_/.test(withoutExt) && !/\s/.test(withoutExt)) {
      candidates[0].count++;
    }
    // Kebab case (e.g., "company-nda-v2")
    else if (/-/.test(withoutExt) && !/\s/.test(withoutExt)) {
      candidates[1].count++;
    }
  }

  const total = candidates.reduce((sum, c) => sum + c.count, 0);
  if (total < MIN_FILES_FOR_DETECTION) {
    return null;
  }

  const sorted = [...candidates].sort((a, b) => b.count - a.count);
  const winner = sorted[0];

  if (winner.count / total < MAJORITY_THRESHOLD) {
    return null;
  }

  return {
    style: winner.style,
    separator: winner.separator,
    date_format: 'YYYY-MM-DD',
  };
}

function detectDomainApplicability(provider: WorkspaceProvider): {
  applicableDomains: string[];
  assetDomains: string[];
} {
  const applicableDomains: string[] = [];
  const assetDomains: string[] = [];

  // Asset-like folder names that don't contain documents in the contract lifecycle sense
  const assetPatterns = /^(logos?|presentations?|media|assets?|images?|demo|benchmarks?|marketing|templates)$/iu;

  try {
    const rootEntries = provider.readdir('.');
    for (const entry of rootEntries) {
      if (!entry.isDirectory) continue;
      if (entry.name.startsWith('.')) continue;

      if (assetPatterns.test(entry.name)) {
        assetDomains.push(entry.name);
      } else {
        applicableDomains.push(entry.name);
      }
    }
  } catch {
    // Empty root
  }

  return { applicableDomains, assetDomains };
}
