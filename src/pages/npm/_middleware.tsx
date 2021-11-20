import type { NextRequest } from "next/server";
import { redirectToPkgVersion } from "../../npm/version-redirect";

export async function middleware(req: NextRequest) {
  try {
    const res = await redirectToPkgVersion(
      Array.isArray(req.page.params!.pkg)
        ? req.page.params!.pkg
        : req.page.params!.pkg.split("/"),
      "/npm"
    );
    return new Response(JSON.stringify({ res }, null, 2));
  } catch (err: any) {
    return new Response(JSON.stringify(err.toString() + err.stack, null, 2));
  }

  // if (res.kind === "handled" && "redirect" in res.result) {
  //   return Response.redirect(res.result.redirect.destination, 307);
  // }
}
