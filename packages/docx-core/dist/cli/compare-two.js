import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { compareDocuments } from '../index.js';
const USAGE = 'Usage: docx-comparison <original.docx> <revised.docx> [output.docx] ' +
    '[--engine atomizer|auto] [--mode inplace|rebuild] [--author "Name"] [--premerge-runs true|false]';
function parseBooleanFlag(raw, flagName) {
    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized))
        return true;
    if (['0', 'false', 'no', 'off'].includes(normalized))
        return false;
    throw new Error(`Invalid value for ${flagName}: ${raw}. Use true or false.`);
}
export function parseCompareCliArgs(argv) {
    const positional = [];
    const options = {
        engine: 'atomizer',
        reconstructionMode: 'rebuild',
        author: 'Comparison',
        premergeRuns: true,
    };
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (!token)
            continue;
        if (!token.startsWith('--')) {
            positional.push(token);
            continue;
        }
        const consumeValue = (flagName) => {
            const next = argv[i + 1];
            if (!next || next.startsWith('--')) {
                throw new Error(`Missing value for ${flagName}.\n${USAGE}`);
            }
            i += 1;
            return next;
        };
        switch (token) {
            case '--engine': {
                const engine = consumeValue(token);
                if (engine !== 'atomizer' && engine !== 'auto') {
                    throw new Error(`Unsupported engine: ${engine}. Use atomizer or auto.`);
                }
                options.engine = engine;
                break;
            }
            case '--mode': {
                const mode = consumeValue(token);
                if (mode !== 'inplace' && mode !== 'rebuild') {
                    throw new Error(`Unsupported mode: ${mode}. Use inplace or rebuild.`);
                }
                options.reconstructionMode = mode;
                break;
            }
            case '--author':
                options.author = consumeValue(token);
                break;
            case '--premerge-runs':
                options.premergeRuns = parseBooleanFlag(consumeValue(token), token);
                break;
            default:
                throw new Error(`Unknown option: ${token}.\n${USAGE}`);
        }
    }
    if (positional.length < 2 || positional.length > 3) {
        throw new Error(`Expected <original.docx> <revised.docx> [output.docx].\n${USAGE}`);
    }
    const [originalPath, revisedPath, outputPath] = positional;
    if (!originalPath || !revisedPath) {
        throw new Error(`Expected <original.docx> <revised.docx> [output.docx].\n${USAGE}`);
    }
    return {
        originalPath,
        revisedPath,
        outputPath,
        options,
    };
}
function defaultOutputPath(revisedAbs, options) {
    return revisedAbs.replace(/\.docx$/i, '') + `.REDLINE.${options.engine}.${options.reconstructionMode}.docx`;
}
export async function runCompareCli(argv = process.argv.slice(2)) {
    if (argv.includes('--help') || argv.includes('-h')) {
        return { help: true, text: USAGE };
    }
    const parsed = parseCompareCliArgs(argv);
    const originalAbs = resolve(parsed.originalPath);
    const revisedAbs = resolve(parsed.revisedPath);
    const outputAbs = resolve(parsed.outputPath ?? defaultOutputPath(revisedAbs, parsed.options));
    const [originalBuffer, revisedBuffer] = await Promise.all([
        readFile(originalAbs),
        readFile(revisedAbs),
    ]);
    const result = await compareDocuments(originalBuffer, revisedBuffer, {
        engine: parsed.options.engine,
        author: parsed.options.author,
        reconstructionMode: parsed.options.reconstructionMode,
        premergeRuns: parsed.options.premergeRuns,
    });
    await mkdir(dirname(outputAbs), { recursive: true });
    await writeFile(outputAbs, result.document);
    return {
        output: outputAbs,
        engine: result.engine,
        mode: parsed.options.reconstructionMode,
        bytes: result.document.length,
        stats: result.stats,
    };
}
//# sourceMappingURL=compare-two.js.map