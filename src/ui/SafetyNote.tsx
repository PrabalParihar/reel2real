/** Visible grown-up note. Rendered only when a demo catalog entry sets safetyNote. */
export function SafetyNote({ note }: { note?: string | null }) {
  const text = note?.trim();
  if (!text) return null;
  return <p className="supervision-note">{text}</p>;
}
