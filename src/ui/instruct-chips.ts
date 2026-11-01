export const PHONE_STAND_HINT = "Prop your phone or laptop so the camera sees your workspace.";

export function instructHonestyChips(mock: boolean): { plan: string; sam: string } {
  if (mock) return { plan: "Mock plan", sam: "SAM box" };
  return { plan: "Live · muse-spark-1.3 plan", sam: "Live · SAM box" };
}
