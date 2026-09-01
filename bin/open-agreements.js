#!/usr/bin/env node
import { runCli } from '../dist/cli/index.js';

try {
  await runCli(process.argv);
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
