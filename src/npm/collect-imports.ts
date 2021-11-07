// https://github.com/Microsoft/TypeScript/blob/3ef3cdddb338b8f0e6a2c5971d255390b68654ac/src/compiler/program.ts#L2369
import { ts } from "../extract/ts";
import { assertNever } from "../lib/assert";

const PossiblyContainsDynamicImport = 1 << 20;

export function collectImports(file: ts.SourceFile): ts.StringLiteralLike[] {
  const isExternalModuleFile = ts.isExternalModule(file);

  let imports: ts.StringLiteralLike[] = [];

  for (const node of file.statements) {
    collectModuleReferences(node, /*inAmbientModule*/ false);
  }
  if (file.flags & PossiblyContainsDynamicImport) {
    collectDynamicImportOrRequireCalls(file);
  }

  return imports;

  function collectModuleReferences(
    node: ts.Statement,
    inAmbientModule: boolean
  ): void {
    if (isAnyImportOrReExport(node)) {
      const moduleNameExpr = getExternalModuleName(node);
      // TypeScript 1.0 spec (April 2014): 12.1.6
      // An ExternalImportDeclaration in an AmbientExternalModuleDeclaration may reference other external modules
      // only through top - level external module names. Relative external module names are not permitted.
      if (
        moduleNameExpr &&
        ts.isStringLiteral(moduleNameExpr) &&
        moduleNameExpr.text &&
        (!inAmbientModule ||
          !ts.isExternalModuleNameRelative(moduleNameExpr.text))
      ) {
        imports.push(moduleNameExpr);
      }
    } else if (ts.isModuleDeclaration(node)) {
      if (
        isAmbientModule(node) &&
        (inAmbientModule ||
          (ts as any).hasSyntacticModifier(node, ts.ModifierFlags.Ambient) ||
          file.isDeclarationFile)
      ) {
        (node.name as Mutable<ts.Node>).parent = node;
        const nameText = getTextOfIdentifierOrLiteral(node.name);
        // Ambient module declarations can be interpreted as augmentations for some existing external modules.
        // This will happen in two cases:
        // - if current file is external module then module augmentation is a ambient module declaration defined in the top level scope
        // - if current file is not external module then module augmentation is an ambient module declaration with non-relative module name
        //   immediately nested in top level ambient module declaration .
        if (
          !inAmbientModule &&
          !(
            isExternalModuleFile ||
            (inAmbientModule && !ts.isExternalModuleNameRelative(nameText))
          )
        ) {
          // An AmbientExternalModuleDeclaration declares an external module.
          // This type of declaration is permitted only in the global module.
          // The StringLiteral must specify a top - level external module name.
          // Relative external module names are not permitted
          // NOTE: body of ambient module is always a module block, if it exists
          const body = node.body;
          if (body) {
            for (const statement of body.statements) {
              collectModuleReferences(statement, /*inAmbientModule*/ true);
            }
          }
        }
      }
    }
  }

  function collectDynamicImportOrRequireCalls(file: ts.SourceFile) {
    const r = /import|require/g;
    while (r.exec(file.text) !== null) {
      // eslint-disable-line no-null/no-null
      const node = getNodeAtPosition(file, r.lastIndex);
      // we have to check the argument list has length of at least 1. We will still have to process these even though we have parsing error.
      if (
        isImportCall(node) &&
        node.arguments.length >= 1 &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        imports.push(node.arguments[0]);
      } else if (isLiteralImportTypeNode(node)) {
        imports.push(node.argument.literal);
      }
    }
  }

  /** Returns a token if position is in [start-of-leading-trivia, end) */
  function getNodeAtPosition(
    sourceFile: ts.SourceFile,
    position: number
  ): ts.Node {
    let current: ts.Node = sourceFile;
    const getContainingChild = (child: ts.Node) => {
      if (
        child.pos <= position &&
        (position < child.end ||
          (position === child.end &&
            child.kind === ts.SyntaxKind.EndOfFileToken))
      ) {
        return child;
      }
    };
    while (true) {
      const child = ts.forEachChild(current, getContainingChild);
      if (!child) {
        return current;
      }
      current = child;
    }
  }
}

type Mutable<T extends object> = { -readonly [K in keyof T]: T[K] };

function isImportCall(n: ts.Node): n is ts.ImportCall {
  return (
    n.kind === ts.SyntaxKind.CallExpression &&
    (n as ts.CallExpression).expression.kind === ts.SyntaxKind.ImportKeyword
  );
}

function isLiteralImportTypeNode(n: ts.Node): n is LiteralImportTypeNode {
  return (
    ts.isImportTypeNode(n) &&
    ts.isLiteralTypeNode(n.argument) &&
    ts.isStringLiteral(n.argument.literal)
  );
}

type LiteralImportTypeNode = ts.ImportTypeNode & {
  readonly argument: ts.LiteralTypeNode & {
    readonly literal: ts.StringLiteral;
  };
};

function getTextOfIdentifierOrLiteral(node: ts.PropertyNameLiteral): string {
  return ts.isMemberName(node) ? idText(node) : node.text;
}

export function idText(
  identifierOrPrivateName: ts.Identifier | ts.PrivateIdentifier
): string {
  return ts.unescapeLeadingUnderscores(identifierOrPrivateName.escapedText);
}

function isAmbientModule(node: ts.Node): node is AmbientModuleDeclaration {
  return (
    ts.isModuleDeclaration(node) &&
    (node.name.kind === ts.SyntaxKind.StringLiteral ||
      isGlobalScopeAugmentation(node))
  );
}

function isGlobalScopeAugmentation(module: ts.ModuleDeclaration): boolean {
  return !!(module.flags & ts.NodeFlags.GlobalAugmentation);
}

interface AmbientModuleDeclaration extends ts.ModuleDeclaration {
  readonly body?: ts.ModuleBlock;
}

export function getExternalModuleName(
  node:
    | AnyImportOrReExport
    | ts.ImportTypeNode
    | ts.ImportCall
    | ts.ModuleDeclaration
): ts.Expression | undefined {
  switch (node.kind) {
    case ts.SyntaxKind.ImportDeclaration:
    case ts.SyntaxKind.ExportDeclaration:
      return node.moduleSpecifier;
    case ts.SyntaxKind.ImportEqualsDeclaration:
      return node.moduleReference.kind === ts.SyntaxKind.ExternalModuleReference
        ? node.moduleReference.expression
        : undefined;
    case ts.SyntaxKind.ImportType:
      return isLiteralImportTypeNode(node) ? node.argument.literal : undefined;
    case ts.SyntaxKind.CallExpression:
      return node.arguments[0];
    case ts.SyntaxKind.ModuleDeclaration:
      return node.name.kind === ts.SyntaxKind.StringLiteral
        ? node.name
        : undefined;
    default:
      return assertNever(node);
  }
}

type AnyImportSyntax = ts.ImportDeclaration | ts.ImportEqualsDeclaration;

type AnyImportOrReExport = AnyImportSyntax | ts.ExportDeclaration;

function isAnyImportOrReExport(node: ts.Node): node is AnyImportOrReExport {
  return isAnyImportSyntax(node) || ts.isExportDeclaration(node);
}

function isAnyImportSyntax(node: ts.Node): node is AnyImportSyntax {
  switch (node.kind) {
    case ts.SyntaxKind.ImportDeclaration:
    case ts.SyntaxKind.ImportEqualsDeclaration:
      return true;
    default:
      return false;
  }
}
