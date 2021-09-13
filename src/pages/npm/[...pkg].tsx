import { getPackage } from "../../extract/from-npm";
import {
  GetStaticPropsContext,
  GetStaticPathsResult,
  InferGetStaticPropsType,
  GetStaticPropsResult,
} from "next";
import * as semver from "semver";

import { Root } from "../../components/root";
import { useMemo } from "react";
import { resolveToPackageVersion } from "../../extract/utils";
import {
  getPackageMetadata,
  PackageNotFoundError,
} from "../../extract/fetch-package-metadata";
import { compressToUTF16, decompressFromUTF16 } from "lz-string";
import { DocInfo } from "../../extract";

export default function Npm(
  _props: InferGetStaticPropsType<typeof getStaticProps>
) {
  const data = useMemo(() => {
    if (typeof _props.data === "object") {
      return _props.data;
    }
    const decompressed = decompressFromUTF16(_props.data);
    if (decompressed === null) {
      throw new Error("decompression failed");
    }
    return JSON.parse(decompressed) as DocInfo;
  }, [_props]);

  return <Root {...data} />;
}

export function getStaticPaths(): GetStaticPathsResult {
  return { paths: [], fallback: "blocking" };
}

export async function getStaticProps({
  params,
}: GetStaticPropsContext): Promise<
  GetStaticPropsResult<{ data: DocInfo | string }>
> {
  const query: string = (params as any).pkg.join("/");
  const [, pkgName, specifier] = query.match(/^(@?[^@]+)(?:@(.+))?/)!;
  try {
    if (!specifier || !semver.parse(specifier)) {
      const pkg = await getPackageMetadata(pkgName);
      const version = resolveToPackageVersion(pkg, specifier);
      return {
        redirect: {
          permanent: false,
          destination: `/npm/${pkgName}@${version}`,
        },
        revalidate: 60 * 20,
      };
    }

    let data: DocInfo | string = await getPackage(pkgName, specifier);
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
      props: { data },
      revalidate: 60 * 60,
    };
  } catch (err) {
    if (err instanceof PackageNotFoundError) {
      return { notFound: true } as const;
    }
    throw err;
  }
}
