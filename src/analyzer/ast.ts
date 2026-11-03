import * as ts from 'typescript';
import * as fs from 'fs';

export function findModifiedFunctions(filePath: string): string[] {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
    );

    const functions: string[] = [];

    function visit(node: ts.Node) {
        if (
            ts.isFunctionDeclaration(node) ||
            ts.isMethodDeclaration(node) ||
            ts.isArrowFunction(node)
        ) {
            let name = 'anonymous';
            if (ts.isFunctionDeclaration(node) && node.name) {
                name = node.name.text;
            } else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
                name = node.name.text;
            }
            functions.push(name);
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return functions;
}
