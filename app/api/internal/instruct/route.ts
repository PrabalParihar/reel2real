import { handleInstructRequest } from "@/src/server/instruct";
import { guardMetaRoute } from "@/src/server/meta-guard";
import { museSecretRejected, museTooLargeResponse, readMuseBody } from "@/src/server/muse-forward";
import { forwardSecretOk, SAM_FORWARD_SECRET_HEADER } from "@/src/server/sam-forward";

export const dynamic = "force-dynamic";

function rejected(): Response {
  return museSecretRejected();
}

export function GET() { return rejected(); }
export function PUT() { return rejected(); }
export function PATCH() { return rejected(); }
export function DELETE() { return rejected(); }
export function HEAD() { return rejected(); }

export async function POST(request: Request) {
  if (!forwardSecretOk(request.headers.get(SAM_FORWARD_SECRET_HEADER), process.env)) {
    return rejected();
  }
  const blocked = guardMetaRoute(request);
  if (blocked) return blocked;
  let rawBody: string | null;
  try { rawBody = await readMuseBody(request); }
  catch { return Response.json({ error: "invalid_request", message: "The request body could not be read." }, { status: 400 }); }
  if (rawBody === null) return museTooLargeResponse();
  return handleInstructRequest(new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: rawBody,
    signal: request.signal,
  }), { skipGuard: true, skipForward: true });
}
