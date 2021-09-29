import { JSDocableNode, ts, Symbol, Project } from "ts-morph";
import semver from "semver";
import path from "path";
import { convertTypeNode } from "./convert-node";
import { convertType } from "./convert-type";
import hashString from "@emotion/hash";
import { assert } from "../lib/assert";
import { DocInfo, getProject, getTypeChecker } from ".";
import {
  TypeParam,
  ObjectMember,
  Parameter,
  SerializedDeclaration,
} from "../lib/types";
import { PackageMetadata } from "./fetch-package-metadata";

export function getTypeParameters(
  node: ts.Node & {
    typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration>;
  }
): TypeParam[] {
  return (node.typeParameters || []).map((typeParam) => {
    return {
      name: typeParam.name.text,
      constraint: typeParam.constraint
        ? convertTypeNode(typeParam.constraint)
        : null,
      default: typeParam.default ? convertTypeNode(typeParam.default) : null,
    };
  });
}

export function getObjectMembers(
  node: ts.Node & {
    members: ts.NodeArray<ts.TypeElement>;
  }
): ObjectMember[] {
  return node.members.map((member): ObjectMember => {
    assert(member.decorators === undefined);
    if (ts.isIndexSignatureDeclaration(member)) {
      assert(member.questionToken === undefined);
      assert(member.typeParameters === undefined);
      assert(member.parameters.length === 1);
      assert(
        member.modifiers?.find(
          (x) => x.kind !== ts.SyntaxKind.ReadonlyKeyword
        ) === undefined
      );
      return {
        kind: "index",
        key: convertTypeNode(member.parameters[0].type!),
        value: convertTypeNode(member.type),
        readonly:
          member.modifiers?.some(
            (x) => x.kind === ts.SyntaxKind.ReadonlyKeyword
          ) || false,
        docs: getDocsFromCompilerNode(member),
      };
    }

    if (ts.isPropertySignature(member)) {
      assert(member.initializer === undefined);
      assert(
        member.modifiers?.find(
          (x) => x.kind !== ts.SyntaxKind.ReadonlyKeyword
        ) === undefined
      );
      return {
        kind: "prop",
        name: ts.isIdentifier(member.name)
          ? member.name.text
          : member.name.getText(),
        docs: getDocsFromCompilerNode(member),
        optional: !!member.questionToken,
        readonly:
          member.modifiers?.some(
            (x) => x.kind === ts.SyntaxKind.ReadonlyKeyword
          ) || false,
        type: member.type
          ? convertTypeNode(member.type)
          : { kind: "intrinsic", value: "any" },
      };
    }

    if (ts.isMethodSignature(member)) {
      return {
        kind: "method",
        name: ts.isIdentifier(member.name)
          ? member.name.text
          : member.name.getText(),
        optional: !!member.questionToken,
        parameters: getParameters(member),
        typeParams: getTypeParameters(member),
        docs: getDocsFromCompilerNode(member),
        returnType: member.type
          ? convertTypeNode(member.type)
          : { kind: "intrinsic", value: "any" },
      };
    }
    const isCallSignature = ts.isCallSignatureDeclaration(member);
    if (isCallSignature || ts.isConstructSignatureDeclaration(member)) {
      assert(member.questionToken === undefined);
      return {
        kind: isCallSignature ? "call" : "constructor",
        parameters: getParameters(member),
        typeParams: getTypeParameters(member),
        docs: getDocsFromCompilerNode(member),
        returnType: member.type
          ? convertTypeNode(member.type)
          : { kind: "intrinsic", value: "any" },
      };
    }
    return { kind: "unknown", content: member.getText() };
  });
}

export function getParameters(
  node: ts.Node & {
    parameters: ts.NodeArray<ts.ParameterDeclaration>;
  }
): Parameter[] {
  return node.parameters.map((x): Parameter => {
    return {
      name: ts.isIdentifier(x.name) ? x.name.text : x.name.getText(),
      type: x.type
        ? convertTypeNode(x.type)
        : convertType(getTypeChecker().getTypeAtLocation(x)),
      kind: x.dotDotDotToken
        ? "rest"
        : x.questionToken || x.initializer
        ? "optional"
        : "normal",
    };
  });
}

function getJsDocCommentTextMarkdown(
  comment: string | undefined | ts.NodeArray<ts.JSDocComment>
) {
  if (comment === undefined) {
    return "";
  }
  if (typeof comment === "string") {
    return comment;
  }

  return comment
    .map((x) => {
      if (ts.isJSDocLink(x) && x.name) {
        const symbol = getSymbolAtLocation(x.name);
        if (symbol) {
          const finalSymbol = getAliasedSymbol(symbol) || symbol;

          return `[${
            x.text || finalSymbol.getName()
          }](#symbol-${getSymbolIdentifier(finalSymbol)})`;
        } else {
          console.log(
            "could not get symbol for link with text at:",
            x.getFullText(),
            x.getSourceFile().fileName
          );
        }
      }

      return x.text;
    })
    .join("");
}

export function wrapInTsMorphSymbol(symbol: ts.Symbol): Symbol {
  return (getProject() as any)._context.compilerFactory.getSymbol(symbol);
}

export function getAliasedSymbol(symbol: ts.Symbol): ts.Symbol | undefined {
  if (!(symbol.flags & ts.SymbolFlags.Alias)) {
    return undefined;
  }
  return getTypeChecker().getAliasedSymbol(symbol);
}

export function getDocsFromJSDocNodes(nodes: ts.JSDoc[]) {
  return nodes
    .map((x) => {
      let fromTags = (x.tags || [])
        .filter((x) => x.tagName.text !== "module")
        .map((x) => {
          return `@${x.tagName.text} — ${getJsDocCommentTextMarkdown(
            x.comment
          )}`;
        })
        .join("\n\n");
      if (fromTags) {
        fromTags = `\n\n${fromTags}`;
      }
      return getJsDocCommentTextMarkdown(x.comment) + fromTags;
    })
    .join("\n\n");
}

export function getDocsFromCompilerNode(decl: ts.Node) {
  let nodes = ((decl as any).jsDoc ?? []) as ts.JSDoc[];
  return getDocsFromJSDocNodes(
    nodes.filter(
      (x) =>
        x.tags === undefined || x.tags.every((x) => x.tagName.text !== "module")
    )
  );
}

export function getDocs(decl: JSDocableNode) {
  return getDocsFromJSDocNodes(
    decl
      .getJsDocs()
      .filter((x) => x.getTags().every((x) => x.getTagName() !== "module"))
      .map((x) => x.compilerNode)
  );
}

export function getSymbolIdentifier(_symbol: Symbol | ts.Symbol) {
  const symbol =
    _symbol instanceof Symbol ? _symbol : wrapInTsMorphSymbol(_symbol);
  const decls = symbol.getDeclarations();
  if (decls.length === 0) {
    const fullName = symbol.getFullyQualifiedName();
    if (fullName === "unknown" || fullName === "globalThis") {
      return fullName;
    }
    assert(false, "expected at least one declaration");
  }

  return hashString(
    decls
      .map((decl) => {
        const filepath = decl.getSourceFile().getFilePath();
        return `${decl.getKindName()}-${filepath}-${decl.getPos()}-${decl.getEnd()}`;
      })
      .join("-")
  );
}

export function getSymbolAtLocation(
  compilerNode: ts.Node
): ts.Symbol | undefined {
  const typeChecker = getTypeChecker();
  const boundSymbol = (compilerNode as any).symbol as ts.Symbol | undefined;
  if (boundSymbol !== undefined) {
    return boundSymbol;
  }

  const typeCheckerSymbol = typeChecker.getSymbolAtLocation(compilerNode);
  if (typeCheckerSymbol !== undefined) {
    return typeCheckerSymbol;
  }

  const nameNode = (compilerNode as any).name as ts.Node | undefined;
  if (nameNode != null) {
    return getSymbolAtLocation(nameNode);
  }

  return undefined;
}

export function getSymbolsForInnerBitsAndGoodIdentifiers(
  accessibleSymbols: Record<string, SerializedDeclaration[]>,
  packageName: string,
  canonicalExportLocations: DocInfo["canonicalExportLocations"],
  symbolReferences: Record<string, string[]>,
  _rootSymbols: string[]
) {
  const rootSymbols = new Set(_rootSymbols);
  const unexportedToExportedRef = new Map<string, string>();
  const unexportedToUnexportedRef = new Map<string, string>();

  for (const [symbolFullName, symbols] of Object.entries(symbolReferences)) {
    if (
      !canonicalExportLocations[symbolFullName] &&
      accessibleSymbols[symbolFullName] &&
      accessibleSymbols[symbolFullName][0].kind !== "enum-member"
    ) {
      const firstExportedSymbol = symbols.find(
        (x) => canonicalExportLocations[x] !== undefined
      );
      if (firstExportedSymbol) {
        unexportedToExportedRef.set(symbolFullName, firstExportedSymbol);
      } else {
        unexportedToUnexportedRef.set(symbolFullName, symbols[0]);
      }
    }
  }

  while (unexportedToUnexportedRef.size) {
    for (const [
      unexportedSymbol,
      unexportedReferencedLocation,
    ] of unexportedToUnexportedRef) {
      if (unexportedToExportedRef.has(unexportedReferencedLocation)) {
        unexportedToUnexportedRef.delete(unexportedSymbol);
        unexportedToExportedRef.set(
          unexportedSymbol,
          unexportedToExportedRef.get(unexportedReferencedLocation)!
        );
      }
      if (unexportedToUnexportedRef.has(unexportedReferencedLocation)) {
        unexportedToUnexportedRef.set(
          unexportedSymbol,
          unexportedToUnexportedRef.get(unexportedReferencedLocation)!
        );
      }
    }
  }
  const symbolsForInnerBit = new Map<string, string[]>();

  for (const [unexported, exported] of unexportedToExportedRef) {
    if (!symbolsForInnerBit.has(exported)) {
      symbolsForInnerBit.set(exported, []);
    }
    symbolsForInnerBit.get(exported)!.push(unexported);
  }

  const goodIdentifiers: Record<string, string> = {};

  const findIdentifier = (symbol: string): string => {
    if (rootSymbols.has(symbol)) {
      const name = accessibleSymbols[symbol][0].name;
      if (name === packageName) {
        return "/";
      }
      return name.replace(packageName, "");
    }
    const canon = canonicalExportLocations[symbol];
    assert(!!canon);
    const [exportName, parent] = canon;
    return `${findIdentifier(parent)}.${exportName}`;
  };

  for (const [symbolId, [symbol]] of Object.entries(accessibleSymbols)) {
    if (symbol.kind == "enum-member") continue;
    if (rootSymbols.has(symbolId)) {
      goodIdentifiers[symbolId] = symbol.name;
    } else if (canonicalExportLocations[symbolId]) {
      goodIdentifiers[symbolId] = findIdentifier(symbolId);
    } else {
      const exportedSymbol = unexportedToExportedRef.get(symbolId)!;
      assert(exportedSymbol !== undefined);
      const symbolsShownInUnexportedBit =
        symbolsForInnerBit.get(exportedSymbol)!;
      const innerThings = symbolsShownInUnexportedBit.filter(
        (x) => accessibleSymbols[x][0].name === symbol.name
      );
      const identifier = `${findIdentifier(exportedSymbol)}.${symbol.name}`;
      if (innerThings.length === 1) {
        goodIdentifiers[symbolId] = identifier;
      } else {
        const index = innerThings.indexOf(symbolId);
        goodIdentifiers[symbolId] = `${identifier}-${index}`;
      }
    }
    if (symbol.kind === "enum") {
      for (const childSymbolId of symbol.members) {
        goodIdentifiers[
          childSymbolId
        ] = `${goodIdentifiers[symbolId]}.${accessibleSymbols[childSymbolId][0].name}`;
      }
    }
  }
  return {
    goodIdentifiers,
    symbolsForInnerBit: Object.fromEntries(symbolsForInnerBit),
  };
}

export async function collectEntrypointsOfPackage(
  project: Project,
  pkgName: string,
  pkgPath: string
) {
  const packageJsons = new Set([
    `${pkgPath}/package.json`,
    ...(await project
      .getFileSystem()
      .glob([
        `${pkgPath}/**/package.json`,
        `!${pkgPath}/node_modules/**/package.json`,
      ])),
  ]);
  const entrypoints = new Map<string, string>();
  const moduleResolutionCache = ts.createModuleResolutionCache(
    project.getFileSystem().getCurrentDirectory(),
    (x) => x,
    project.getCompilerOptions()
  );
  for (const x of packageJsons) {
    const entrypoint = path.join(
      pkgName,
      x.replace(pkgPath, "").replace(/\/?package\.json$/, "")
    );
    const resolved = ts.resolveModuleName(
      entrypoint,
      "/index.js",
      project.getCompilerOptions(),
      project.getModuleResolutionHost(),
      moduleResolutionCache
    ).resolvedModule?.resolvedFileName;
    if (!resolved) continue;
    entrypoints.set(entrypoint, resolved);
  }
  return entrypoints;
}

export function resolveToPackageVersion(
  pkg: PackageMetadata,
  specifier: string | undefined
): string {
  if (specifier !== undefined) {
    if (Object.prototype.hasOwnProperty.call(pkg.tags, specifier)) {
      return pkg.tags[specifier];
    }
    if (semver.validRange(specifier)) {
      const version = semver.maxSatisfying(pkg.versions, specifier);
      if (version) {
        return version;
      }
    }
  }
  return pkg.tags.latest;
}
