import { assert, assertNever } from "../lib/assert";
import {
  Parameter,
  SerializedDeclaration,
  SerializedType,
  SymbolId,
  TypeParam,
} from "../lib/types";
import { getCoreDocsInfo } from "./core";
import { getSymbolIdentifier } from "./core/utils";
import { ts } from "./ts";

function getPrinted(filename: string) {
  const program = ts.createProgram({ options: {}, rootNames: [filename] });
  const sourceFile = program.getSourceFile(filename);
  assert(sourceFile !== undefined, `could not get source file ${filename}`);
  const rootSymbol = program.getTypeChecker().getSymbolAtLocation(sourceFile);
  assert(rootSymbol !== undefined, "could not get symbol for source file");
  const rootSymbols = new Map([[rootSymbol, "test"]]);
  const info = getCoreDocsInfo(rootSymbols, program, (symbol) => {
    const sourceFile = symbol.declarations![0].getSourceFile();
    return sourceFile.fileName !== filename;
  });

  let result = "";
  for (const [symbol, decls] of info.accessibleSymbols) {
    result += "\n\n";
    result += `${getSymbolIdentifier(symbol)}: ${symbol.name}`;
    for (const decl of decls) {
      if (decl.kind === "namespace") {
        result += `\nnamespace ${decl.name} {
        export {
        ${Object.entries(decl.exports)
          .map(([exportName, exportSymbolId]) => {
            return `  ${exportSymbolId} as ${exportName} }`;
          })
          .join(",\n")}\n}\n}\n`;
      } else if (decl.kind === "enum" || decl.kind === "enum-member") {
        throw new Error("unhandled");
      } else if (decl.kind === "module") {
        result += `\nmodule ${JSON.stringify(decl.name)} {
          export {
          ${Object.entries(decl.exports)
            .map(([exportName, exportSymbolId]) => {
              return `  ${exportSymbolId} as ${exportName} }`;
            })
            .join(",\n")}\n}\n}\n`;
      } else {
        result += `\n${printBasicDeclaration(decl, (symbolId, name) => {
          return `${name}(${symbolId})`;
        })}\n`;
      }
    }
    result += "\n\n";
  }

  return result;
}

function printBasicDeclaration(
  decl: Exclude<
    SerializedDeclaration,
    { kind: "module" | "namespace" | "enum" | "enum-member" }
  >,
  printReference: (symbolId: SymbolId, name: string) => string
): string {
  if (decl.kind === "class") {
    return (
      "class " +
      decl.name +
      (decl.extends === null
        ? ""
        : ` extends ${printSerializedType(decl.extends, printReference)}`) +
      (decl.implements.length
        ? ` implements ${decl.implements
            .map((x) => printSerializedType(x, printReference))
            .join(", ")}`
        : "") +
      " {\n" +
      (decl.willBeComparedNominally ? "  has private members\n" : "") +
      decl.constructors
        .map(
          (x) =>
            `  constructor${printParameters(x.parameters, printReference)}\n`
        )
        .join("\n") +
      decl.members.map((member): string => {
        if (member.kind === "index") {
          return `  ${
            member.static ? "static " : ""
          }[key: ${printSerializedType(
            member.key,
            printReference
          )}]: ${printSerializedType(member.value, printReference)}\n`;
        }
        if (member.kind === "method") {
          return `  ${member.static ? "static " : ""}${member.name}${
            member.optional ? "?" : ""
          }${printTypeParams(
            member.typeParams,
            printReference
          )}${printParameters(
            member.parameters,
            printReference
          )}: ${printSerializedType(member.returnType, printReference)}`;
        }
        if (member.kind === "prop") {
          return `  ${member.static ? "static " : ""}${member.name}${
            member.optional ? "?" : ""
          }: ${printSerializedType(member.type, printReference)}`;
        }
        if (member.kind === "unknown") {
          return `  RAW ${member.content}`;
        }
        assertNever(member);
      })
    );
  }
  if (decl.kind === "function") {
    return `function ${decl.name}${printTypeParams(
      decl.typeParams,
      printReference
    )}${printParameters(
      decl.parameters,
      printReference
    )}: ${printSerializedType(decl.returnType, printReference)}`;
  }
  if (decl.kind === "variable") {
    return `${decl.variableKind} ${decl.name}: ${printSerializedType(
      decl.type,
      printReference
    )} = ...`;
  }
  if (decl.kind === "type-alias") {
    return `type ${decl.name}${printTypeParams(
      decl.typeParams,
      printReference
    )} = ${printSerializedType(decl.type, printReference)}`;
  }
  if (decl.kind === "interface") {
    return `interface ${decl.name}${printTypeParams(
      decl.typeParams,
      printReference
    )}${
      decl.extends.length
        ? ` extends ${decl.extends
            .map((x) => printSerializedType(x, printReference))
            .join(", ")}`
        : ""
    } { ${printSerializedType(
      { kind: "object", members: decl.members },
      printReference
    )}`;
  }
  if (decl.kind === "unknown") {
    return `RAW ${decl.content}`;
  }
  assertNever(decl);
}

function printSerializedType(
  type: SerializedType,
  printReference: (symbolId: SymbolId, name: string) => string
): string {
  if (type.kind === "intrinsic") {
    return type.value;
  }
  if (type.kind === "bigint-literal") {
    return type.value;
  }
  if (type.kind === "numeric-literal") {
    return type.value.toString();
  }
  if (type.kind === "array") {
    return `${type.readonly ? "readonly " : ""}${printSerializedType(
      type,
      printReference
    )}[]`;
  }
  if (type.kind === "raw") {
    return `RAW ${type.value} RAW`;
  }
  if (type.kind === "infer") {
    return `infer ${type.name}`;
  }
  if (type.kind === "keyof") {
    return `keyof ${printSerializedType(type, printReference)}`;
  }
  if (type.kind === "union") {
    return type.types
      .map((x) => printSerializedType(x, printReference))
      .join(" | ");
  }
  if (type.kind === "intersection") {
    return type.types
      .map((x) => printSerializedType(x, printReference))
      .join(" & ");
  }
  if (type.kind === "paren") {
    return `(${printSerializedType(type, printReference)})`;
  }
  if (type.kind === "string-literal") {
    return JSON.stringify(type.value);
  }
  if (type.kind === "indexed-access") {
    return `${printSerializedType(
      type.object,
      printReference
    )}[${printSerializedType(type.index, printReference)}]`;
  }
  if (type.kind === "tuple") {
    return `${type.readonly ? "readonly " : ""}[${type.elements
      .map((element): string => {
        if (element.kind === "rest") {
          return `...${
            element.label === null ? "" : element.label + ": "
          }${printSerializedType(element.type, printReference)}`;
        }
        let start = `${
          element.label === null ? "" : element.label + ": "
        }${printSerializedType(element.type, printReference)}`;

        if (element.kind === "optional") {
          return start + "?";
        }
        return start;
      })
      .join(", ")}]`;
  }
  if (type.kind === "mapped") {
    return `{\n  ${
      { [-1]: "-readonly ", 0: "", 1: "readonly " }[type.readonly]
    }[${type.param.name} in ${type.param.constraint}${
      type.as === null
        ? ""
        : " as " + printSerializedType(type.as, printReference)
    }]${{ [-1]: "-?", 0: "", 1: "?" }[type.optional]}: ${printSerializedType(
      type.type,
      printReference
    )}\n}`;
  }
  if (type.kind === "type-parameter") {
    return `${type.name}(type param)`;
  }
  if (type.kind === "type-predicate") {
    return `${type.asserts ? "asserts " : ""}${type.param}${
      type.type ? " is " + printSerializedType(type.type, printReference) : ""
    }`;
  }
  if (type.kind === "conditional") {
    return `${printSerializedType(
      type.checkType,
      printReference
    )} extends ${printSerializedType(
      type.extendsType,
      printReference
    )} ? ${printSerializedType(
      type.trueType,
      printReference
    )} : ${printSerializedType(type.falseType, printReference)}`;
  }
  if (type.kind === "signature" || type.kind === "constructor") {
    return `${type.kind === "constructor" ? "new " : ""}${printTypeParams(
      type.typeParams,
      printReference
    )}${printParameters(type.parameters, printReference)} => ${
      type.returnType
    }`;
  }
  if (type.kind === "template") {
    return (
      "`" +
      JSON.stringify(type.head).slice(1, -1) +
      type.rest.map(
        (x) =>
          `\${${printSerializedType(x.type, printReference)}}${JSON.stringify(
            x.text
          ).slice(1, -1)}`
      ) +
      "`"
    );
  }

  if (type.kind === "object") {
    return `{\n${type.members
      .map((value) => {
        if (value.kind === "call") {
          return `${printTypeParams(
            value.typeParams,
            printReference
          )}${printParameters(
            value.parameters,
            printReference
          )}: ${printSerializedType(value.returnType, printReference)}`;
        }
        if (value.kind === "index") {
          return `[key: ${printSerializedType(value.key, printReference)}]`;
        }
        return value.kind;
      })
      .join("\n")}\n}`;
  }
  if (type.kind === "reference") {
    return `${printReference(type.fullName, type.name)}${
      type.typeArguments.length
        ? `<${type.typeArguments.map((x) =>
            printSerializedType(x, printReference)
          )}>`
        : ""
    }`;
  }

  if (type.kind === "typeof") {
    return `typeof ${printReference(type.fullName, type.name)}`;
  }

  return assertNever(type);
}

function printParameters(
  params: Parameter[],
  printReference: (symbolId: SymbolId, name: string) => string
) {
  return `(${params.map((param) => {
    if (param.kind === "optional") {
      return `${param.name}?: ${printSerializedType(
        param.type,
        printReference
      )}`;
    }
    if (param.kind === "rest") {
      return `...${param.name}: ${printSerializedType(
        param.type,
        printReference
      )}`;
    }
    return `${param.name}: ${printSerializedType(param.type, printReference)}`;
  })})`;
}

function printTypeParams(
  typeParams: TypeParam[],
  printReference: (symbolId: SymbolId, name: string) => string
) {
  if (typeParams.length === 0) {
    return "";
  }
  return `<${typeParams
    .map((typeParam) => {
      return `${typeParam.name}${
        typeParam.constraint === null
          ? ""
          : ` extends ${printSerializedType(
              typeParam.constraint,
              printReference
            )}`
      }${
        typeParam.default === null
          ? ""
          : ` = ${printSerializedType(typeParam.default, printReference)}`
      }`;
    })
    .join(", ")}>`;
}

test("basic", () => {
  expect(getPrinted(require.resolve("./fixtures/basic.ts")));
});
