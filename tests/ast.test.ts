import { describe, it, expect } from 'vitest';
import { findModifiedFunctions } from '../src/analyzer/ast';
import * as path from 'path';

describe('AST Analyzer', () => {
    it('should detect functions in a file', () => {
        const samplePath = path.join(__dirname, '../src/analyzer/ast.ts');
        const funcs = findModifiedFunctions(samplePath);
        expect(funcs).toContain('findModifiedFunctions');
    });
});
