import { getPackage } from "../../npm";
import {
  GetStaticPropsContext,
  GetStaticPathsResult,
  InferGetStaticPropsType,
  GetStaticPropsResult,
} from "next";

import { Root } from "../../components/root";
import { useMemo } from "react";
import { compressToUTF16, decompressFromUTF16 } from "lz-string";
import { DocInfo } from "../../extract";
import { redirectToPkgVersion } from "../../npm/version-redirect";
import { inspect } from "util";

export default function Npm(
  _props: InferGetStaticPropsType<typeof getStaticProps>
) {
  const props = useMemo(() => {
    if (_props.kind === "error") {
      return _props;
    }
    if (typeof _props.data === "object") {
      return { kind: "package" as const, data: _props.data };
    }
    const decompressed = decompressFromUTF16(_props.data);
    if (decompressed === null) {
      throw new Error("decompression failed");
    }
    return {
      kind: "package" as const,
      data: JSON.parse(decompressed) as DocInfo,
    };
  }, [_props]);

  if (props.kind === "error") {
    return props.error;
  }

  return <Root {...props.data} />;
}

export function getStaticPaths(): GetStaticPathsResult {
  return { paths: [], fallback: "blocking" };
}

export async function getStaticProps({
  params,
}: GetStaticPropsContext): Promise<
  GetStaticPropsResult<
    | { kind: "package"; data: DocInfo | string }
    | { kind: "error"; error: string }
  >
> {
  try {
    const res = await redirectToPkgVersion(params?.pkg, "/npm");
    if (res.kind === "handled") {
      return res.result;
    }
    if (res.restParams.length) {
      return { notFound: true };
    }

    let data: DocInfo | string = await getPackage(res.pkg, res.version);
    const stringified = JSON.stringify(data);
    // you might be thinking: why are you compressing this?
    // it's just gonna result in a larger size when it's eventually gzipped
    // yes! you are correct!
    // but Lambda has a limit of 6MB on the request and response
    // (i'm pretty sure that's as in both combined can't exceed 6MB)
    // https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html
    // and the size of the generated results of some packages can exceed that
    // so for large packages things, we compress it before it leaves the Lambda
    // which does indeed result in a larger payload over the wire
    // but it means that packages will have to be _even_ larger for this to fail

    if (stringified.length > 1000000) {
      data = compressToUTF16(stringified);
    }
    return {
      props: { kind: "package", data },
      revalidate: 60 * 60,
    };
  } catch (err) {
    return { props: { kind: "error", error: inspect(err) } };
  }
}
