export const REFUSAL_UNSAFE = "This goal is not a safe household task the camera can check.";
export const REFUSAL_NOT_VISUAL = "This goal is not something a camera can check step by step.";

const SPELLING: Array<[RegExp, string]> = [
  [/\bbleech(?:es|s)?\b/g, "bleach"],
  [/\bbleach(?:es|s)?\b/g, "bleach"],
  [/\bam+on+i+a+s?\b/g, "ammonia"],
  [/\bvin[ae]g[ae]rs?\b/g, "vinegar"],
  [/\bch?lorines?\b/g, "chlorine"],
  [/\bch?loramines?\b/g, "chloramine"],
  [/\bcolours?\b/g, "color"],
  [/\bexplosiv(?:es|e)?\b/g, "explosive"],
  [/\bexplossiv(?:es|e)?\b/g, "explosive"],
  [/\bbombs?\b/g, "bomb"],
  [/\bpoisons?\b/g, "poison"],
  [/\bpoisions?\b/g, "poison"],
  [/\bweapons?\b/g, "weapon"],
  [/\bguns?\b/g, "gun"],
  [/\bgrenades?\b/g, "grenade"],
  [/\bfent[ae]n[yi]ls?\b/g, "fentanyl"],
  [/\bheroi?ns?\b/g, "heroin"],
  [/\bcocaines?\b/g, "cocaine"],
  [/\bcocains?\b/g, "cocaine"],
  [/\bsuicides?\b/g, "suicide"],
  [/\bsucides?\b/g, "suicide"],
];

const NOT_VISUAL = [
  /\b(essay|novel|homework|calculus|algebra)\b/,
  /\b(hack|phishing|malware|password)\b/,
  /\b(crypto|bitcoin|stock market|invest|day trade)\b/,
  /\bwrite (an? )?(code|program|app|website|email|paper)\b/,
  /\b(summarize|translate) (this|the|an?) (article|pdf|document|book)\b/,
];

/** Lowercase, drop punctuation, and fold plurals and common misspellings. */
export function normalizeGoalText(value: string): string {
  let text = value.toLowerCase().replace(/['’]/g, "");
  text = text.replace(/[+&/]/g, " and ");
  text = text.replace(/[^a-z0-9\s]/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  for (const [pattern, word] of SPELLING) text = text.replace(pattern, word);
  return text;
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function chemicalMix(text: string): boolean {
  const bleach = has(text, /\bbleach\b/);
  const ammonia = has(text, /\bammonia\b/);
  const vinegar = has(text, /\bvinegar\b/);
  const acid = has(text, /\bacid\b/);
  const base = has(text, /\b(base|lye|caustic|hydroxide|naoh)\b/);
  const chlorine = has(text, /\b(chlorine|chloramine)\b/);
  const drain = has(text, /\bdrain cleaner\b/);
  const high = [bleach, ammonia, chlorine, drain].filter(Boolean).length;
  const mix = has(text, /\b(mix|mixing|mixed|combine|combined|combining|blend|blended|react|reaction)\b/);
  if (high >= 2) return true;
  if (bleach && (vinegar || acid || base)) return true;
  if (ammonia && (vinegar || acid || base)) return true;
  if (drain && (vinegar || bleach || ammonia || acid)) return true;
  if (chlorine && (ammonia || bleach || vinegar || acid)) return true;
  if (acid && base) return true;
  if (mix && high >= 1 && (vinegar || acid || base || high >= 2)) return true;
  if (has(text, /\bchemical reaction\b/)) return true;
  if (has(text, /\bcolor reaction\b/)) return true;
  if (has(text, /\bflask\b/) && has(text, /\breaction\b/)) return true;
  if (has(text, /\b(chlorine|chloramine) gas\b/)) return true;
  return false;
}

function bannedTopic(text: string): boolean {
  if (chemicalMix(text)) return true;
  if (has(text, /\b(bomb|explosive|grenade|napalm|molotov|weapon|gun|pistol|rifle|firearm|ammunition|ammo)\b/)) return true;
  if (has(text, /\b(poison(ing|ed|ous)?|ricin|cyanide|arsenic|strychnine|anthrax)\b/)) return true;
  if (has(text, /\b(suicide|self harm|kill myself|hurt myself)\b/)) return true;
  if (has(text, /\b(heroin|cocaine|fentanyl|meth|methamphetamine)\b/)) return true;
  if (has(text, /\b(synthesis|synthesise|synthesize|synthesizing|synthesising)\b/) && has(text, /\b(drug|heroin|cocaine|fentanyl|meth|methamphetamine)\b/)) return true;
  if (has(text, /\b(murder|kill someone)\b/)) return true;
  return false;
}

/** Shared by the instruct page and the instruct and spark routes. */
export function screenGoal(goal: string): { reason: string } | null {
  const text = normalizeGoalText(goal);
  if (!text) return null;
  if (bannedTopic(text)) return { reason: REFUSAL_UNSAFE };
  if (NOT_VISUAL.some((pattern) => pattern.test(text))) return { reason: REFUSAL_NOT_VISUAL };
  return null;
}

/** Sample demos are not goals. A typed transcript still is. */
export function screenSparkInput(input: {
  transcript?: string | null;
  title?: string | null;
  sampleId?: string | null;
}): { reason: string } | null {
  if (input.sampleId && !input.transcript?.trim()) return null;
  const text = [input.transcript, input.sampleId ? "" : input.title].filter((part) => part && part.trim()).join("\n");
  return screenGoal(text);
}

export function looksLikeModelRefusal(text: string): boolean {
  const normalized = normalizeGoalText(text);
  if (!normalized) return false;
  return (
    /\b(cannot|cant|unable)\b.{0,48}\b(help|assist|provide|comply)\b/.test(normalized)
    || /\b(i )?must refuse\b/.test(normalized)
    || /\brefus(e|al|ed|ing)\b/.test(normalized)
    || /\bsafety (policy|guideline|filter)\b/.test(normalized)
    || /\bnot (able|allowed) to (help|assist)\b/.test(normalized)
  );
}

export function modelRefusalReason(input: {
  refused?: boolean;
  reason?: string;
  refusalReason?: string;
  message?: string;
  errors?: string[];
}): string | null {
  if (input.refused) return input.reason || input.refusalReason || REFUSAL_UNSAFE;
  const blob = [input.reason, input.refusalReason, input.message, ...(input.errors ?? [])].filter((part) => typeof part === "string" && part.trim()).join(" ");
  if (blob && looksLikeModelRefusal(blob)) return input.reason || input.refusalReason || REFUSAL_UNSAFE;
  return null;
}
