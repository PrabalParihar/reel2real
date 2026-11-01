import { handleInstructRequest } from "@/src/server/instruct";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleInstructRequest(request);
}
