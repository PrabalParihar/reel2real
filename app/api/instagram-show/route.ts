import { handleInstagramShow } from "@/src/server/instagram-show";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleInstagramShow(request);
}
