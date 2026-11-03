import type { FindResult } from '../core/types.js';
import { findModifiedFunctions } from '../analyzer/ast.js';

export function formatFindTerminal(result: FindResult): string {
    if (result.verdict !== 'culprit-found' || !result.culprit) {
        return `Verdict: ${result.verdict}\nNo specific culprit commit identified.`;
    }

    const commit = result.culprit;
    let report = `Verdict: culprit-found\n`;
    report += `Culprit Commit: ${commit.sha} (${commit.subject})\n`;
    report += `Author: ${commit.author}\n`;
    report += `Files Changed:\n`;

    const allFunctions: string[] = [];

    for (const file of commit.files) {
        report += ` - ${file}\n`;
        const funcs = findModifiedFunctions(file);
        if (funcs.length > 0) {
            allFunctions.push(...funcs);
        }
    }

    if (allFunctions.length > 0) {
        report += `Suspected Functions (AST Detected):\n`;
        const uniqueFuncs = Array.from(new Set(allFunctions));
        for (const fn of uniqueFuncs) {
            report += ` * ${fn}()\n`;
        }
    }

    return report;
}

export function formatFindJson(result: FindResult): string {
    const allFunctions: string[] = [];
    if (result.culprit) {
        for (const file of result.culprit.files) {
            const funcs = findModifiedFunctions(file);
            allFunctions.push(...funcs);
        }
    }

    return JSON.stringify({
        ...result,
        suspectedFunctions: Array.from(new Set(allFunctions))
    }, null, 2);
}
