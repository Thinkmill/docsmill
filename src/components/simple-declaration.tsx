/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { Fragment } from "react";
import { codeFont, syntaxColors } from "../lib/theme.css";
import {
  ClassMember,
  Parameter,
  SimpleSerializedDeclaration,
} from "../lib/types";
import { Docs } from "./docs";
import { Indent } from "./indent";
import { a } from "./markdown.css";
import { Syntax } from "./syntax";
import { TypeParams, Params, Type } from "./type";

export const declarationNameStyles = css(codeFont, {
  color: syntaxColors.symbol,
});

export function DeclarationName({ name }: { name: string }) {
  return <span css={declarationNameStyles}>{name}</span>;
}

export function SimpleDeclaration({
  decl,
  isExported,
}: {
  decl: SimpleSerializedDeclaration;
  isExported: boolean;
}) {
  if (decl.kind === "function") {
    return (
      <Fragment>
        <Syntax kind="keyword">{isExported ? "export " : ""}function </Syntax>
        <DeclarationName name={decl.name} />
        <TypeParams params={decl.typeParams} />
        <Params params={decl.parameters} />
        <Syntax kind="colon">: </Syntax>
        <Type type={decl.returnType} />
      </Fragment>
    );
  }
  if (decl.kind === "variable") {
    return (
      <Fragment>
        <Syntax kind="keyword">
          {isExported ? "export " : ""}
          {decl.variableKind}{" "}
        </Syntax>
        <DeclarationName name={decl.name} />
        <Syntax kind="colon">: </Syntax>
        <Type type={decl.type} />
        <Syntax kind="bracket">{" = "}</Syntax>
        <span css={codeFont}>...</span>
      </Fragment>
    );
  }

  if (decl.kind === "unknown") {
    return (
      <Fragment>
        <DeclarationName name={decl.name} />
        <pre css={codeFont}>
          <code>{decl.content}</code>
        </pre>
      </Fragment>
    );
  }

  if (decl.kind === "interface") {
    const interfaceSymbol = decl;
    return (
      <Fragment>
        <Syntax kind="keyword">
          {isExported ? "export " : ""}
          interface{" "}
        </Syntax>
        <DeclarationName name={decl.name} />
        <TypeParams params={decl.typeParams} />
        {!!decl.extends.length && (
          <Fragment>
            <Syntax kind="keyword"> extends </Syntax>
            {decl.extends.map((param, i) => {
              return (
                <Fragment key={i}>
                  <Type type={param} />
                  {i === interfaceSymbol.extends.length - 1 ? null : (
                    <Syntax kind="comma">{", "}</Syntax>
                  )}
                </Fragment>
              );
            })}
          </Fragment>
        )}
        <span css={codeFont}> </span>
        <Type type={{ kind: "object", members: decl.members }} />
      </Fragment>
    );
  }

  if (decl.kind === "class") {
    const classSymbol = decl;
    return (
      <Fragment>
        {decl.willBeComparedNominally && (
          <p>
            This class has private members, so it it will be compared nominally
            instead of structurally.{" "}
            <a
              css={a}
              href="https://www.typescriptlang.org/docs/handbook/type-compatibility.html#private-and-protected-members-in-classes"
            >
              See the TypeScript reference for more details.
            </a>
          </p>
        )}
        <Syntax kind="keyword">
          {isExported ? "export " : ""}
          class{" "}
        </Syntax>
        <DeclarationName name={decl.name} />
        <TypeParams params={decl.typeParams} />
        {!!classSymbol.extends && (
          <Fragment>
            <Syntax kind="keyword"> extends </Syntax>
            <Type type={classSymbol.extends} />
          </Fragment>
        )}
        {!!decl.implements.length && (
          <Fragment>
            <Syntax kind="keyword"> implements </Syntax>
            {decl.implements.map((param, i) => {
              return (
                <Fragment key={i}>
                  <Type type={param} />
                  {i === classSymbol.implements.length - 1 ? null : (
                    <Syntax kind="comma">{", "}</Syntax>
                  )}
                </Fragment>
              );
            })}
          </Fragment>
        )}
        <span css={codeFont}> </span>
        <ClassMembers constructors={decl.constructors} members={decl.members} />
      </Fragment>
    );
  }

  return (
    <Fragment>
      <Syntax kind="keyword">
        {isExported ? "export " : ""}
        type{" "}
      </Syntax>
      <DeclarationName name={decl.name} />
      <TypeParams params={decl.typeParams} />
      <span css={codeFont}> = </span>
      <Type type={decl.type} />
    </Fragment>
  );
}

function ClassMembers({
  members,
  constructors,
}: {
  constructors: {
    parameters: Parameter[];
    docs: string;
  }[];
  members: ClassMember[];
}) {
  if (members.length === 0 && constructors.length === 0) {
    return <span css={codeFont}>{"{}"}</span>;
  }
  return (
    <Fragment>
      <span css={codeFont}>{"{ "}</span>
      {constructors.map((constructor, i) => {
        return (
          <Indent key={i}>
            <Docs content={constructor.docs} />
            <Syntax kind="keyword">constructor</Syntax>
            <Params params={constructor.parameters} />
          </Indent>
        );
      })}
      {members.map(function ClassMember(prop, i) {
        if (prop.kind === "prop") {
          return (
            <Indent key={i}>
              <Docs content={prop.docs} />
              {prop.readonly || prop.static ? (
                <Syntax kind="keyword">
                  {prop.static ? "static " : ""}
                  {prop.readonly ? "readonly " : ""}
                </Syntax>
              ) : null}
              <span css={codeFont}>{prop.name}</span>
              <Syntax kind="colon">{prop.optional ? "?: " : ": "}</Syntax>
              <Type type={prop.type} />
              <span css={codeFont}>;</span>
            </Indent>
          );
        }
        if (prop.kind === "index") {
          return (
            <Indent key={i}>
              <span css={codeFont}>
                [key<Syntax kind="colon">: </Syntax>
              </span>
              <Type type={prop.key} />
              <span css={codeFont}>]</span>
              <Syntax kind="colon">: </Syntax>
              <Type type={prop.value} />
              <span css={codeFont}>;</span>
            </Indent>
          );
        }
        if (prop.kind === "unknown") {
          return (
            <Indent key={i}>
              <span css={codeFont}>{prop.content}</span>
            </Indent>
          );
        }
        return (
          <Indent key={i}>
            <Docs content={prop.docs} />
            <span css={codeFont}>{prop.name}</span>
            <TypeParams params={prop.typeParams} />
            <Params params={prop.parameters} />
            <Syntax kind="colon">: </Syntax>
            <Type type={prop.returnType} />
            <span css={codeFont}>;</span>
          </Indent>
        );
      })}
      <span css={codeFont}>{" }"}</span>
    </Fragment>
  );
}
