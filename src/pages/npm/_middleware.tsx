import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { redirectToPkgVersion } from "../../npm/version-redirect";

export async function middleware(req: NextRequest) {
  const res = await redirectToPkgVersion(req.page.params?.pkg, "/npm");
  if (res.kind === "handled" && "redirect" in res.result) {
    return NextResponse.redirect(res.result.redirect.destination, 307);
  }
  return new Response(JSON.stringify(res, null, 2));
}
