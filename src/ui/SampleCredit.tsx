import { SAMPLE_SCENES, sceneByDemo } from "@/src/samples/scene";

function shortAuthor(author: string): string {
  return author.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/** Pexels line for the two Sample clips. Author names come from each steps.json. */
export function SampleCredit({ className = "sample-credits" }: { className?: string }) {
  const chai = sceneByDemo("masala-chai") ?? SAMPLE_SCENES[0];
  const bike = sceneByDemo("bike-chain") ?? SAMPLE_SCENES[1];
  if (!chai || !bike) return null;
  return (
    <p className={className}>
      Sample footage: mortar kitchen clip on <a href={chai.sourceClip.page}>Pexels</a> ({shortAuthor(chai.sourceClip.author)}); bike chain clean by <a href={bike.sourceClip.page}>{bike.sourceClip.author}</a>. <a href="https://www.pexels.com/license/">Pexels License</a>. Overlays labelled Sample · recorded SAM output.
    </p>
  );
}
