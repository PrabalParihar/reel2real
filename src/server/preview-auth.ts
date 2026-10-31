export type PreviewDecision = "open" | "allow" | "deny" | "closed";

function sameSecret(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export function previewDecision(input: { password: string | undefined; authorization: string | null }): PreviewDecision {
  if (input.password === undefined) return "open";
  if (input.password.trim() === "") return "closed";
  const header = input.authorization ?? "";
  if (!header.startsWith("Basic ")) return "deny";
  let decoded = "";
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return "deny";
  }
  const split = decoded.indexOf(":");
  if (split < 0) return "deny";
  const password = decoded.slice(split + 1);
  return sameSecret(password, input.password) ? "allow" : "deny";
}
