import type { NextRequest } from "next/server";
import { redirectToPkgVersion } from "../../npm/version-redirect";

export async function middleware(req: NextRequest) {
  const res = await redirectToPkgVersion(
    Array.isArray(req.page.params!.pkg)
      ? req.page.params!.pkg
      : req.page.params!.pkg.split("/"),
    "/npm"
  );
  if (res.kind === "handled" && "redirect" in res.result) {
    return Response.redirect(res.result.redirect.destination, 307);
  }
  return new Response(JSON.stringify({ res }, null, 2));
}
