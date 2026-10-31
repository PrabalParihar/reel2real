import { RESPONSES_PATH } from "@/src/models";
import { redactSecrets } from "./redact";

export interface UpstreamIds {
  requestId: string;
  route: string;
}

export interface MetaErrorFields {
  type: string;
  code: string;
  message: string;
}

/** Only the two debug headers. The Authorization header is never copied out. */
export function readUpstreamHeaders(headers: { get(name: string): string | null }): UpstreamIds {
  return {
    requestId: headers.get("x-request-id")?.trim() || "",
    route: headers.get("x-route")?.trim() || "",
  };
}

export function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url || RESPONSES_PATH;
  }
}

/** Meta's JSON error envelope. Message is redacted, then cut to 200 characters. */
export function parseMetaError(body: string, secrets: Array<string | null | undefined> = []): MetaErrorFields {
  let type = "";
  let code = "";
  let message = "";
  try {
    const parsed = JSON.parse(body) as { error?: { type?: unknown; code?: unknown; message?: unknown } };
    const error = parsed?.error;
    if (error && typeof error === "object") {
      if (typeof error.type === "string") type = error.type;
      if (typeof error.code === "string") code = error.code;
      if (typeof error.message === "string") message = error.message;
    }
  } catch {
    message = "";
  }
  message = message.replace(/\s+/g, " ").trim();
  message = redactSecrets(message, secrets);
  message = message.replace(/authorization\s*:\s*\S+/gi, "");
  message = message.replace(/bearer\s+\S+/gi, "");
  message = message.replace(/\s+/g, " ").trim();
  if (message.length > 200) message = message.slice(0, 200);
  return { type, code, message };
}

export function metaUpstreamLog(input: {
  path: string;
  model: string;
  status: number;
  requestId: string;
  route: string;
  latencyMs: number;
  error?: MetaErrorFields | null;
}): string {
  const requestId = input.requestId || "-";
  const route = input.route || "-";
  const base = `Meta upstream POST ${input.path} model=${input.model || "-"} status=${input.status} request_id=${requestId} route=${route} latency_ms=${input.latencyMs}`;
  if (!input.error) return base;
  const type = input.error.type || "-";
  const code = input.error.code || "-";
  const message = input.error.message || "-";
  return `${base} error_type=${type} error_code=${code} error_message=${message}`;
}

export function samFailureLog(input: {
  status: number;
  url: string;
  body: string;
  requestId?: string;
  route?: string;
  latencyMs?: number;
  model?: string;
  secrets?: Array<string | null | undefined>;
}): string {
  return metaUpstreamLog({
    path: pathnameOf(input.url),
    model: input.model || "sam-3.1",
    status: input.status,
    requestId: input.requestId || "",
    route: input.route || "",
    latencyMs: input.latencyMs ?? 0,
    error: parseMetaError(input.body, input.secrets),
  });
}

export function sparkFailureLog(input: {
  status: number;
  url: string;
  body: string;
  requestId?: string;
  route?: string;
  latencyMs?: number;
  model?: string;
  secrets?: Array<string | null | undefined>;
}): string {
  return metaUpstreamLog({
    path: pathnameOf(input.url),
    model: input.model || "muse-spark-1.3",
    status: input.status,
    requestId: input.requestId || "",
    route: input.route || "",
    latencyMs: input.latencyMs ?? 0,
    error: parseMetaError(input.body, input.secrets),
  });
}
