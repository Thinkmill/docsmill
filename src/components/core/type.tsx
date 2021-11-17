/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import { Fragment, ReactElement } from "react";

import { codeFont } from "../../lib/theme.css";

import { Syntax } from "../syntax";
import { Indent } from "../indent";
import {
  SerializedType,
  TypeParam,
  Parameter,
  SymbolId,
} from "../../lib/types";

import { css } from "@emotion/react";
import { codeFontStyleObj } from "../../lib/theme.css";

const intrinsicStyles = css({ color: "#2c8093", ...codeFontStyleObj });

export type Components = {
  Docs: (props: { docs: string }) => ReactElement | null;
  SymbolReference: (props: { id: SymbolId; name: string }) => ReactElement;
};

export function Type({
  type,
  components,
}: {
  type: SerializedType;
  components: Components;
}): ReactElement {
  if (type.kind === "intrinsic") {
    return <span css={intrinsicStyles}>{type.value}</span>;
  }
  if (type.kind === "reference") {
    return (
      <Fragment>
        <components.SymbolReference name={type.name} id={type.id} />
        {type.typeArguments && (
          <Fragment>
            <span css={codeFont}>{"<"}</span>
            {type.typeArguments.map((param, i) => {
              return (
                <Fragment key={i}>
                  <Type components={components} type={param} />
                  {i === type.typeArguments!.length - 1 ? null : (
                    <Syntax kind="comma">, </Syntax>
                  )}
                </Fragment>
              );
            })}
            <span css={codeFont}>{">"}</span>
          </Fragment>
        )}
      </Fragment>
    );
  }
  if (type.kind === "array") {
    return (
      <Fragment>
        {type.readonly ? <Syntax kind="keyword">readonly </Syntax> : null}
        <Type components={components} type={type.inner} />
        <Syntax kind="bracket">[]</Syntax>
      </Fragment>
    );
  }
  if (type.kind === "type-parameter") {
    return <Syntax kind="parameter">{type.name}</Syntax>;
  }
  if (type.kind === "union") {
    return (
      <Fragment>
        {type.types.map((innerType, i) => {
          return (
            <Fragment key={i}>
              <Type components={components} type={innerType} />
              {i !== type.types.length - 1 && (
                <Syntax kind="colon">{" | "}</Syntax>
              )}
            </Fragment>
          );
        })}
      </Fragment>
    );
  }
  if (type.kind === "intersection") {
    return (
      <Fragment>
        {type.types.map((innerType, i) => {
          return (
            <Fragment key={i}>
              <Type components={components} type={innerType} />
              {i !== type.types.length - 1 && (
                <Syntax kind="colon">{" & "}</Syntax>
              )}
            </Fragment>
          );
        })}
      </Fragment>
    );
  }
  if (type.kind === "object") {
    if (type.members === undefined) {
      return <span css={codeFont}>{"{}"}</span>;
    }
    return (
      <Fragment>
        <span css={codeFont}>{"{ "}</span>
        {type.members.map(function ObjectMember(prop, i) {
          if (prop.kind === "prop") {
            return (
              <Indent key={i}>
                <components.Docs docs={prop.docs} />
                {prop.readonly ? (
                  <Syntax kind="keyword">readonly </Syntax>
                ) : null}
                <span css={codeFont}>{prop.name}</span>
                <Syntax kind="colon">{prop.optional ? "?: " : ": "}</Syntax>
                <Type components={components} type={prop.type} />
                <span css={codeFont}>;</span>
              </Indent>
            );
          }
          if (prop.kind === "index") {
            return (
              <Indent key={i}>
                {prop.readonly ? (
                  <Syntax kind="keyword">readonly </Syntax>
                ) : null}
                <span css={codeFont}>
                  [key<Syntax kind="colon">: </Syntax>
                </span>
                <Type components={components} type={prop.key} />
                <span css={codeFont}>]</span>
                <Syntax kind="colon">: </Syntax>
                <Type components={components} type={prop.value} />
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
              <components.Docs docs={prop.docs} />
              {prop.kind === "constructor" && (
                <Syntax kind="keyword">new </Syntax>
              )}
              {prop.kind === "method" && (
                <span css={codeFont}>{prop.name}</span>
              )}
              <TypeParams components={components} params={prop.typeParams} />
              <Params components={components} params={prop.parameters} />
              <Syntax kind="colon">: </Syntax>
              <Type components={components} type={prop.returnType} />
              <span css={codeFont}>;</span>
            </Indent>
          );
        })}
        <span css={codeFont}>{" }"}</span>
      </Fragment>
    );
  }
  if (type.kind === "tuple") {
    return (
      <Fragment>
        {type.readonly && <Syntax kind="keyword">readonly </Syntax>}
        <Syntax kind="bracket">[</Syntax>
        {type.elements?.map((element, i) => {
          return (
            <Fragment key={i}>
              {element.kind === "rest" && <Syntax kind="colon">...</Syntax>}
              <Type components={components} type={element.type} />
              {element.kind === "optional" && <span css={codeFont}>?</span>}
              {i !== type.elements!.length - 1 && (
                <Syntax kind="comma">, </Syntax>
              )}
            </Fragment>
          );
        })}
        <Syntax kind="bracket">]</Syntax>
      </Fragment>
    );
  }
  if (type.kind === "indexed-access") {
    return (
      <Fragment>
        <Type components={components} type={type.object} />
        <Syntax kind="bracket">[</Syntax>
        <Type components={components} type={type.index} />
        <Syntax kind="bracket">]</Syntax>
      </Fragment>
    );
  }
  if (type.kind === "conditional") {
    return (
      <Fragment>
        <Type components={components} type={type.checkType} />
        <Syntax kind="keyword"> extends </Syntax>
        <Type components={components} type={type.extendsType} />
        <Syntax kind="colon"> ? </Syntax>
        <Type components={components} type={type.trueType} />
        <Syntax kind="colon"> : </Syntax>
        <Type components={components} type={type.falseType} />
      </Fragment>
    );
  }
  if (type.kind === "string-literal") {
    return <Syntax kind="string">"{type.value}"</Syntax>;
  }
  if (type.kind === "numeric-literal" || type.kind === "bigint-literal") {
    return <Syntax kind="string">{type.value}</Syntax>;
  }
  if (type.kind === "signature" || type.kind === "constructor") {
    return (
      <Fragment>
        {type.kind === "constructor" && <Syntax kind="keyword">new </Syntax>}
        <TypeParams components={components} params={type.typeParams} />
        <Params components={components} params={type.parameters} />
        <Syntax kind="keyword">{" => "}</Syntax>
        <Type components={components} type={type.returnType} />
      </Fragment>
    );
  }
  if (type.kind === "infer") {
    return (
      <Fragment>
        <Syntax kind="keyword">infer </Syntax>
        <Syntax kind="parameter">{type.name}</Syntax>
      </Fragment>
    );
  }
  if (type.kind === "mapped") {
    return (
      <Fragment>
        <span css={codeFont}>{"{ "}</span>
        <Indent>
          {type.readonly === -1 && <Syntax kind="bracket">-</Syntax>}
          {type.readonly !== 0 && (
            <Fragment>
              <Syntax kind="keyword">readonly </Syntax>
            </Fragment>
          )}
          <span css={codeFont}>
            [<Syntax kind="parameter">{type.param.name} </Syntax>
            <Syntax kind="keyword">in </Syntax>
          </span>
          <Type components={components} type={type.param.constraint} />
          {type.as && (
            <Fragment>
              <Syntax kind="keyword"> as </Syntax>
              <Type components={components} type={type.as} />
            </Fragment>
          )}
          <Syntax kind="bracket">
            ]{type.optional === 1 ? "?" : type.optional === -1 ? "-?" : ""}
          </Syntax>
          <Syntax kind="colon">: </Syntax>
          <Type components={components} type={type.type} />
          <span css={codeFont}>;</span>
        </Indent>
        <span css={codeFont}>{" }"}</span>
      </Fragment>
    );
  }

  if (type.kind === "keyof") {
    return (
      <Fragment>
        <Syntax kind="keyword">keyof </Syntax>
        <Type components={components} type={type.value} />
      </Fragment>
    );
  }
  if (type.kind === "paren") {
    return (
      <Fragment>
        <Syntax kind="bracket">(</Syntax>
        <Type components={components} type={type.value} />
        <Syntax kind="bracket">)</Syntax>
      </Fragment>
    );
  }
  if (type.kind === "typeof") {
    return (
      <Fragment>
        <Syntax kind="keyword">typeof </Syntax>
        <components.SymbolReference id={type.id} name={type.name} />
      </Fragment>
    );
  }
  if (type.kind === "type-predicate") {
    return (
      <Fragment>
        {type.asserts && <Syntax kind="keyword">asserts </Syntax>}
        <span css={codeFont}>{type.param}</span>
        {type.type && (
          <Fragment>
            <Syntax kind="keyword">{" is "}</Syntax>
            <Type components={components} type={type.type} />
          </Fragment>
        )}
      </Fragment>
    );
  }
  if (type.kind === "template") {
    return (
      <Fragment>
        <Syntax kind="string">`{type.head}</Syntax>
        {type.rest?.map((element, i) => {
          return (
            <Fragment key={i}>
              <Syntax kind="colon">{"${"}</Syntax>
              <Type components={components} type={element.type} />
              <Syntax kind="colon">{"}"}</Syntax>
              <Syntax kind="string">{element.text}</Syntax>
            </Fragment>
          );
        })}
        <Syntax kind="string">`</Syntax>
      </Fragment>
    );
  }

  return <span css={[codeFont, { color: "red" }]}>{type.value}</span>;
}

export function TypeParams({
  params,
  components,
}: {
  params: [TypeParam, ...TypeParam[]] | undefined;
  components: Components;
}) {
  if (!params) return null;
  return (
    <Fragment>
      <Syntax kind="bracket">{"<"}</Syntax>
      {params.map((param, i) => {
        return (
          <Fragment key={i}>
            <Syntax kind="parameter">{param.name}</Syntax>
            {param.constraint && (
              <Fragment>
                <Syntax kind="keyword"> extends </Syntax>
                <Type components={components} type={param.constraint} />
              </Fragment>
            )}
            {param.default && (
              <Fragment>
                <Syntax kind="colon">{" = "}</Syntax>
                <Type components={components} type={param.default} />
              </Fragment>
            )}
            {i === params.length - 1 ? null : <Syntax kind="comma">, </Syntax>}
          </Fragment>
        );
      })}
      <Syntax kind="bracket">{">"}</Syntax>
    </Fragment>
  );
}

export function Params({
  params,
  components,
}: {
  params: [Parameter, ...Parameter[]] | undefined;
  components: Components;
}) {
  return (
    <Fragment>
      <Syntax kind="bracket">(</Syntax>
      {params?.map((param, i) => {
        return (
          <Fragment key={i}>
            {param.kind === "rest" && <Syntax kind="colon">...</Syntax>}
            <Syntax kind="parameter">{param.name}</Syntax>
            <Syntax kind="colon">
              {param.kind === "optional" ? "?: " : ": "}
            </Syntax>
            <Type components={components} type={param.type} />
            {i === params.length - 1 ? null : <Syntax kind="comma">, </Syntax>}
          </Fragment>
        );
      })}
      <Syntax kind="bracket">)</Syntax>
    </Fragment>
  );
}
