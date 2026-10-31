import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { previewDecision } from "@/src/server/preview-auth";

export const config = {
  runtime: "nodejs",
};

export function middleware(request: NextRequest) {
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
