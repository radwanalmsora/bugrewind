import { describe, it, expect } from 'vitest';
import { generateDetailedEvidenceReport, formatMarkdownReport } from '../src/reports/evidence-report.js';

describe('Evidence Report Generator', () => {
    it('should generate markdown report with certainty and evidence', () => {
        const mockResult: any = {
            verdict: 'culprit-found',
            culprit: { sha: 'abc1234', subject: 'fix bug', author: 'Dev', files: ['src/index.ts'] }
        };
        const report = generateDetailedEvidenceReport(mockResult);
        const md = formatMarkdownReport(report);
        expect(md).toContain('Certainty Level');
        expect(md).toContain('Evidence Breakdown');
    });
});
