#!/usr/bin/env node

import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const SKILLS_ROOT = join(REPO_ROOT, 'skills');
const VALID_TARGETS = new Set(['smithery', 'clawhub', 'both']);
const VALID_SCOPES = new Set(['changed', 'all', 'selected']);

function main() {
  const options = parseArgs(process.argv.slice(2));
  const allSkills = listSkillDirectories();
  const selectedSkills = resolveSelectedSkills(allSkills, options);
  validateTargetRequirements(selectedSkills, options);

  if (selectedSkills.length === 0) {
    console.log(`No skills selected for scope "${options.scope}".`);
    appendSummary([
      '## Skills Directory Publish',
      '',
      `- Dry run: ${options.dryRun ? 'yes' : 'no'}`,
      `- Target: ${options.target}`,
      `- Scope: ${options.scope}`,
      '- Selected skills: none',
    ]);
    return;
  }

  console.log(`Resolved ${selectedSkills.length} skill(s) for target "${options.target}" using scope "${options.scope}":`);
  for (const skill of selectedSkills) {
    console.log(`- ${skill.slug} (${skill.version ?? 'no metadata.version'})`);
  }

  const shortSha = git(['rev-parse', '--short', 'HEAD']).trim();
  const summaryLines = [
    '## Skills Directory Publish',
    '',
    `- Dry run: ${options.dryRun ? 'yes' : 'no'}`,
    `- Target: ${options.target}`,
    `- Scope: ${options.scope}`,
    `- Commit: \`${shortSha}\``,
    '- Selected skills:',
    ...selectedSkills.map((skill) => `  - \`${skill.slug}\` @ \`${skill.version ?? 'n/a'}\``),
  ];

  if (options.dryRun) {
    for (const skill of selectedSkills) {
      for (const command of buildCommands(skill, options, shortSha)) {
        console.log(`[dry-run] ${formatCommand(command.bin, command.args)}`);
      }
    }
    appendSummary(summaryLines);
    return;
  }

  for (const skill of selectedSkills) {
    for (const command of buildCommands(skill, options, shortSha)) {
      runCommand(command.bin, command.args);
    }
  }

  appendSummary(summaryLines);
}

function parseArgs(argv) {
  const options = {
    target: 'both',
    scope: 'changed',
    baseRef: 'HEAD^',
    selectedSkills: '',
    dryRun: false,
    smitheryNamespace: 'open-agreements',
    clawhubChangelog: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--target':
        options.target = requireValue(arg, argv, ++index);
        break;
      case '--scope':
        options.scope = requireValue(arg, argv, ++index);
        break;
      case '--base-ref':
        options.baseRef = requireValue(arg, argv, ++index);
        break;
      case '--selected-skills':
        options.selectedSkills = requireValue(arg, argv, ++index);
        break;
      case '--smithery-namespace':
        options.smitheryNamespace = requireValue(arg, argv, ++index);
        break;
      case '--clawhub-changelog':
        options.clawhubChangelog = requireValue(arg, argv, ++index);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!VALID_TARGETS.has(options.target)) {
    throw new Error(`Invalid --target value "${options.target}". Expected one of: ${[...VALID_TARGETS].join(', ')}`);
  }
  if (!VALID_SCOPES.has(options.scope)) {
    throw new Error(`Invalid --scope value "${options.scope}". Expected one of: ${[...VALID_SCOPES].join(', ')}`);
  }
  if (options.scope === 'selected' && !options.selectedSkills.trim()) {
    throw new Error('--selected-skills is required when --scope selected is used.');
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/publish_skills_directories.mjs [options]

Options:
  --target <smithery|clawhub|both>   Registry target (default: both)
  --scope <changed|all|selected>     Skill selection mode (default: changed)
  --base-ref <git-ref>               Base ref for changed scope (default: HEAD^)
  --selected-skills <csv>            Comma-separated skill slugs for selected scope
  --smithery-namespace <namespace>   Smithery namespace (default: open-agreements)
  --clawhub-changelog <text>         ClawHub changelog text for non-interactive updates
  --dry-run                          Print planned commands without publishing
  --help, -h                         Show this help text`);
}

function requireValue(flag, argv, index) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function listSkillDirectories() {
  const entries = readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((slug) => existsSync(join(SKILLS_ROOT, slug, 'SKILL.md')))
    .sort((left, right) => left.localeCompare(right));

  return entries.map((slug) => readSkillMetadata(slug));
}

function readSkillMetadata(fallbackSlug) {
  const directory = join(SKILLS_ROOT, fallbackSlug);
  const skillFile = join(directory, 'SKILL.md');
  if (!existsSync(skillFile)) {
    throw new Error(`Expected ${skillFile} to exist.`);
  }

  const contents = readFileSync(skillFile, 'utf8');
  const frontmatterMatch = contents.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    throw new Error(`Missing frontmatter in ${skillFile}`);
  }

  const frontmatter = frontmatterMatch[1];
  const slug = stripQuotes(matchRequired(frontmatter, /^name:\s*(.+)$/m, `Missing frontmatter name in ${skillFile}`)) || fallbackSlug;
  const versionMatch = frontmatter.match(/^  version:\s*(.+)$/m);
  const version = versionMatch ? stripQuotes(versionMatch[1].trim()) : null;

  return {
    slug,
    version,
    directory,
    skillFile,
  };
}

function resolveSelectedSkills(allSkills, options) {
  const skillsBySlug = new Map(allSkills.map((skill) => [skill.slug, skill]));

  if (options.scope === 'all') {
    return allSkills;
  }

  if (options.scope === 'selected') {
    const slugs = options.selectedSkills
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean);

    const missing = slugs.filter((slug) => !skillsBySlug.has(slug));
    if (missing.length > 0) {
      throw new Error(`Unknown selected skill(s): ${missing.join(', ')}`);
    }

    return slugs.map((slug) => skillsBySlug.get(slug));
  }

  const changedPaths = git([
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
    `${options.baseRef}...HEAD`,
    '--',
    'skills',
  ])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const changedSlugs = new Set();
  for (const path of changedPaths) {
    const match = path.match(/^skills\/([^/]+)\//);
    if (match) {
      changedSlugs.add(match[1]);
    }
  }

  return allSkills.filter((skill) => changedSlugs.has(skill.slug));
}

function buildCommands(skill, options, shortSha) {
  const commands = [];

  if (options.target === 'smithery' || options.target === 'both') {
    commands.push({
      bin: 'smithery',
      args: ['skill', 'publish', skill.directory, '--namespace', options.smitheryNamespace, '--name', skill.slug],
    });
  }

  if (options.target === 'clawhub' || options.target === 'both') {
    if (!skill.version) {
      throw new Error(`Skill ${skill.slug} is missing metadata.version and cannot be published to ClawHub.`);
    }
    const changelog = options.clawhubChangelog.trim() || `Automated publish from ${shortSha} for ${skill.slug} ${skill.version}`;
    commands.push({
      bin: 'clawhub',
      args: [
        'publish',
        skill.directory,
        '--slug',
        skill.slug,
        '--version',
        skill.version,
        '--changelog',
        changelog,
        '--tags',
        'latest',
      ],
    });
  }

  return commands;
}

function runCommand(bin, args) {
  console.log(`Running: ${formatCommand(bin, args)}`);
  const result = spawnSync(bin, args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`${bin} exited with status ${result.status ?? 'unknown'}`);
  }
}

function validateTargetRequirements(selectedSkills, options) {
  if (options.target !== 'clawhub' && options.target !== 'both') {
    return;
  }

  const missingVersions = selectedSkills.filter((skill) => !skill.version).map((skill) => skill.slug);
  if (missingVersions.length > 0) {
    throw new Error(
      `ClawHub publishing requires metadata.version in SKILL.md. Missing for: ${missingVersions.join(', ')}`,
    );
  }
}

function git(args) {
  const result = spawnSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  }

  return result.stdout.trim();
}

function appendSummary(lines) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }

  appendFileSync(summaryPath, `${lines.join('\n')}\n`);
}

function matchRequired(input, pattern, errorMessage) {
  const match = input.match(pattern);
  if (!match) {
    throw new Error(errorMessage);
  }
  return match[1].trim();
}

function stripQuotes(value) {
  return value.replace(/^['"]|['"]$/g, '').trim();
}

function formatCommand(bin, args) {
  return [bin, ...args].map(shellQuote).join(' ');
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
