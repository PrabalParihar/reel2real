/** A duration chip only when the media reports a real length. Never a 0:00 placeholder. */
export function durationChipLabel(durationSec: number | null | undefined): string | null {
  if (typeof durationSec !== "number" || !Number.isFinite(durationSec) || durationSec <= 0) return null;
  const total = Math.floor(durationSec);
  if (total <= 0) return null;
  const label = `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
  return label === "0:00" ? null : label;
}
