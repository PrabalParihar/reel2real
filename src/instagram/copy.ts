export const IG_SECTION_TITLE = "Watching on Instagram?";
export const IG_FIELD_LABEL = "Paste a public Instagram link";
export const IG_SAVE_HINT = "Save the Reel to your phone, then upload or share the file here.";
export const IG_BAD_URL = "Use a public instagram.com/reel or instagram.com/p link.";
export const IG_FAIL = "This post cannot be shown. It may be private, age-gated, or embeds are turned off.";
export const IG_SHOW = "Show post";
export const IG_VIEW = "View on Instagram";
export const IG_CREDIT_IN_POST = "Creator credit is shown in the Instagram post above.";

export const IG_USER_COPY = [IG_SECTION_TITLE, IG_FIELD_LABEL, IG_SAVE_HINT, IG_BAD_URL, IG_FAIL, IG_SHOW, IG_VIEW, IG_CREDIT_IN_POST];

/** Named author when oEmbed sends one. Otherwise do not call Instagram the creator. */
export function instagramCredit(authorName?: string): { credit: string; authorKnown: boolean } {
  const author = authorName?.replace(/\u2014|\u2013/g, " ").replace(/\s+/g, " ").trim() ?? "";
  if (!author) return { credit: IG_CREDIT_IN_POST, authorKnown: false };
  return { credit: `Credit: ${author} on Instagram`, authorKnown: true };
}
