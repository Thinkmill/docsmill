/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { Fragment } from "react";
import { codeFont, syntaxColors } from "../../lib/theme.css";
import {
  ClassMember,
  ConstructorDeclaration,
  SimpleSerializedDeclaration,
} from "../../lib/types";
import { Indent } from "./indent";
import { Syntax } from "./syntax";
import { TypeParams, Params, Type, Components } from "./type";

const declarationNameStyles = css(codeFont, {
  color: syntaxColors.symbol,
});

export function DeclarationName({ name }: { name: string }) {
  return <span css={declarationNameStyles}>{name}</span>;
}

export function SimpleDeclaration<Docs>({
  decl,
  isExported,
  components,
}: {
  decl: SimpleSerializedDeclaration<Docs>;
  isExported: boolean;
  components: Components<Docs>;
}) {
  if (decl.kind === "function") {
    return (
      <Fragment>
        <Syntax kind="keyword">{isExported ? "export " : ""}function </Syntax>
        <DeclarationName name={decl.name} />
        <TypeParams components={components} params={decl.typeParams} />
        <Params components={components} params={decl.parameters} />
        <Syntax kind="colon">: </Syntax>
        <Type components={components} type={decl.returnType} />
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
        <Type components={components} type={decl.type} />
        <Syntax kind="bracket">{" = ..."}</Syntax>
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
        <TypeParams components={components} params={decl.typeParams} />
        {decl.extends && (
          <Fragment>
            <Syntax kind="keyword"> extends </Syntax>
            {decl.extends.map((param, i) => {
              return (
                <Fragment key={i}>
                  <Type components={components} type={param} />
                  {i === interfaceSymbol.extends!.length - 1 ? null : (
                    <Syntax kind="comma">{", "}</Syntax>
                  )}
                </Fragment>
              );
            })}
          </Fragment>
        )}
        <Syntax kind="bracket"> </Syntax>
        <Type
          components={components}
          type={{ kind: "object", members: decl.members }}
        />
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
            <a href="https://www.typescriptlang.org/docs/handbook/type-compatibility.html#private-and-protected-members-in-classes">
              See the TypeScript reference for more details.
            </a>
          </p>
        )}
        <Syntax kind="keyword">
          {isExported ? "export " : ""}
          class{" "}
        </Syntax>
        <DeclarationName name={decl.name} />
        <TypeParams components={components} params={decl.typeParams} />
        {!!classSymbol.extends && (
          <Fragment>
            <Syntax kind="keyword"> extends </Syntax>
            <Type components={components} type={classSymbol.extends} />
          </Fragment>
        )}
        {decl.implements && (
          <Fragment>
            <Syntax kind="keyword"> implements </Syntax>
            {decl.implements.map((param, i) => {
              return (
                <Fragment key={i}>
                  <Type components={components} type={param} />
                  {i === classSymbol.implements!.length - 1 ? null : (
                    <Syntax kind="comma">{", "}</Syntax>
                  )}
                </Fragment>
              );
            })}
          </Fragment>
        )}
        <Syntax kind="bracket"> </Syntax>
        <ClassMembers
          components={components}
          constructors={decl.constructors}
          members={decl.members}
        />
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
      <TypeParams components={components} params={decl.typeParams} />
      <Syntax kind="bracket"> = </Syntax>
      <Type components={components} type={decl.type} />
    </Fragment>
  );
}

function ClassMembers<Docs>({
  members,
  constructors,
  components,
}: {
  constructors:
    | [ConstructorDeclaration<Docs>, ...ConstructorDeclaration<Docs>[]]
    | undefined;
  members: [ClassMember<Docs>, ...ClassMember<Docs>[]] | undefined;
  components: Components<Docs>;
}) {
  if (members === undefined && constructors === undefined) {
    return <Syntax kind="bracket">{"{}"}</Syntax>;
  }
  return (
    <Fragment>
      <Syntax kind="bracket">{"{ "}</Syntax>
      {constructors?.map((constructor, i) => {
        return (
          <Indent key={i}>
            <components.Docs docs={constructor.docs} />
            <Syntax kind="keyword">constructor</Syntax>
            <Params components={components} params={constructor.parameters} />
          </Indent>
        );
      })}
      {members?.map(function ClassMember(prop, i) {
        if (prop.kind === "prop") {
          return (
            <Indent key={i}>
              <components.Docs docs={prop.docs} />
              {prop.readonly || prop.static ? (
                <Syntax kind="keyword">
                  {prop.static ? "static " : ""}
                  {prop.readonly ? "readonly " : ""}
                </Syntax>
              ) : null}
              <Syntax kind="bracket">{prop.name}</Syntax>
              <Syntax kind="colon">{prop.optional ? "?: " : ": "}</Syntax>
              <Type components={components} type={prop.type} />
              <Syntax kind="bracket">;</Syntax>
            </Indent>
          );
        }
        if (prop.kind === "index") {
          return (
            <Indent key={i}>
              <Syntax kind="bracket">[key</Syntax>
              <Syntax kind="colon">: </Syntax>
              <Type components={components} type={prop.key} />
              <Syntax kind="bracket">]</Syntax>
              <Syntax kind="colon">: </Syntax>
              <Type components={components} type={prop.value} />
              <Syntax kind="bracket">;</Syntax>
            </Indent>
          );
        }
        if (prop.kind === "unknown") {
          return (
            <Indent key={i}>
              <Syntax kind="bracket">{prop.content}</Syntax>
            </Indent>
          );
        }
        return (
          <Indent key={i}>
            <components.Docs docs={prop.docs} />
            <Syntax kind="bracket">{prop.name}</Syntax>
            <TypeParams components={components} params={prop.typeParams} />
            <Params components={components} params={prop.parameters} />
            <Syntax kind="colon">: </Syntax>
            <Type components={components} type={prop.returnType} />
            <Syntax kind="bracket">;</Syntax>
          </Indent>
        );
      })}
      <Syntax kind="bracket">{" }"}</Syntax>
    </Fragment>
  );
}
