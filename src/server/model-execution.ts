import { readModelApiKey } from "./model-key";

export type ModelRoute = "spark" | "instruct" | "segment";
export type ModelExecutionMode = "off" | "direct" | "forward";

/** Configuration evidence only: this does not probe worker/provider health. */
export function modelExecutionMode(env: Record<string, string | undefined>, route: ModelRoute): ModelExecutionMode {
  let worker: URL | null = null;
  try { worker = new URL(env.SAM_FORWARD_URL?.trim() || ""); } catch { /* unconfigured */ }
  const validWorker = worker && ["http:", "https:"].includes(worker.protocol) && !worker.username && !worker.password;
  const secret = Boolean(env.SAM_FORWARD_SECRET?.trim());
  if (worker && validWorker && secret) {
    if (route === "segment" && env.SAM_FORWARD_ENABLED === "1") return "forward";
    if (route !== "segment" && env.MUSE_FORWARD_ENABLED === "1" && /\/api\/internal\/segment\/?$/.test(worker.pathname) && !worker.search && !worker.hash) return "forward";
  }
  return env.META_DIRECT_ENABLED === "1" && readModelApiKey(env) ? "direct" : "off";
}
