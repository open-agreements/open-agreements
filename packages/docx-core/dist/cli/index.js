#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { runCompareCli } from './compare-two.js';
export async function runCli(argv = process.argv) {
    const result = await runCompareCli(argv.slice(2));
    if ('help' in result && result.help) {
        // eslint-disable-next-line no-console
        console.log(result.text);
        return;
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result));
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    runCli(process.argv).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err?.message ?? String(err));
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map