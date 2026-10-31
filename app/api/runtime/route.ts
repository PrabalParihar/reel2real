import { publicRuntime } from "@/src/server/env";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(publicRuntime(process.env));
}
