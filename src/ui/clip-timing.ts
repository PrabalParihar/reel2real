/** Instruct stills carry server stand-in timing. Do not present it as a clip. */
export function hidesClipTiming(input: { stepsSource?: string | null; stillPlaceholder?: boolean | null }): boolean {
  return input.stepsSource === "instruct" || input.stillPlaceholder === true;
}
