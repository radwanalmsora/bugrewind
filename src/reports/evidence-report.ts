import type { FindResult, ReplayResult } from '../core/types.js';

export interface EvidenceItem {
    type: 'pro' | 'con';
    description: string;
}

export interface DetailedEvidenceReport {
    title: string;
    status: string;
    certainty: 'High' | 'Medium' | 'Low';
    evidence: EvidenceItem[];
    rawResult: FindResult | ReplayResult;
}

export function generateDetailedEvidenceReport(result: FindResult | ReplayResult): DetailedEvidenceReport {
    const evidence: EvidenceItem[] = [];
    let certainty: 'High' | 'Medium' | 'Low' = 'High';

    if ('culprit' in result && result.culprit) {
        evidence.push({
            type: 'pro',
            description: `Commit ${result.culprit.sha} introduced test failure in isolated worktree.`
        });
        evidence.push({
            type: 'pro',
            description: `Parent commit passed all tests successfully.`
        });
    } else {
        certainty = 'Low';
        evidence.push({
            type: 'con',
            description: `No definitive single culprit commit isolated with high confidence.`
        });
    }

    return {
        title: 'Bugrewind Evidence & Regression Analysis Report',
        status: result.verdict,
        certainty,
        evidence,
        rawResult: result
    };
}

export function formatMarkdownReport(report: DetailedEvidenceReport): string {
    let md = `# ${report.title}\n\n`;
    md += `* **Verdict Status**: \`${report.status}\`\n`;
    md += `* **Certainty Level**: **${report.certainty}**\n\n`;
    md += `## Evidence Breakdown\n`;
    
    for (const item of report.evidence) {
        const icon = item.type === 'pro' ? '✅ [Supporting]' : '⚠️ [Counter]';
        md += `- ${icon} ${item.description}\n`;
    }

    return md;
}

export function formatJsonReport(report: DetailedEvidenceReport): string {
    return JSON.stringify(report, null, 2);
}
