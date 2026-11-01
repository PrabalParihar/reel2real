import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { previewDecision } from "@/src/server/preview-auth";
import { previewPathIsGated } from "@/src/server/preview-gate";

export const config = {
  runtime: "nodejs",
  // Pages and API routes stay gated. Sample files and the image optimizer must
  // stay public: the optimizer fetches /samples/* without the preview password.
  matcher: [
    "/((?!_next/static|_next/image|samples/|favicon.ico|icon.svg|robots.txt).*)",
  ],
};

export function middleware(request: NextRequest) {
  // Internal forward targets skip this gate. Each route checks the forward secret.
  if (!previewPathIsGated(request.nextUrl.pathname)) return NextResponse.next();
  const decision = previewDecision({
    password: process.env.PREVIEW_PASSWORD,
    authorization: request.headers.get("authorization"),
  });
  if (decision === "open" || decision === "allow") return NextResponse.next();
  if (decision === "closed") {
    return new NextResponse("Preview is closed because PREVIEW_PASSWORD is empty.", {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "cache-control": "no-store",
      "www-authenticate": 'Basic realm="Reel2Real preview", charset="UTF-8"',
    },
  });
}
