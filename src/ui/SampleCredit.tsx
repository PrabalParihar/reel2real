import { demoBySlug, DEMOS } from "@/src/samples/demos";
import { type SampleScene } from "@/src/samples/scene";

function shortAuthor(author: string): string {
  return author.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/** Visible chai line is exactly "Credit · Pexels contributor · Pexels License". */
export function SceneCredit({ scene }: { scene: SampleScene }) {
  if (scene.demo === "masala-chai") {
    return (
      <p className="credit">
        Credit · <a href="https://www.pexels.com/video/5480225/">Pexels contributor</a> · Pexels License
      </p>
    );
  }
  const demo = demoBySlug(scene.demo);
  const author = shortAuthor(demo?.credit.name || scene.sourceClip.author);
  const href = demo?.credit.href || scene.sourceClip.page;
  const license = demo?.credit.license || scene.sourceClip.license || "Pexels License";
  const licenseHref = demo?.credit.licenseHref;
  return (
    <p className="credit">
      Credit · <a href={href}>{author}</a>
      {" · "}
      {licenseHref ? <a href={licenseHref}>{license}</a> : license}
    </p>
  );
}

/** Credits for every demo in the catalog. */
export function SampleCredit({ className = "sample-credits" }: { className?: string }) {
  if (!DEMOS.length) return null;
  return (
    <p className={className}>
      Sample footage: {DEMOS.map((demo, index) => (
        <span key={demo.slug}>
          {index > 0 ? "; " : null}
          <a href={demo.credit.href}>{shortAuthor(demo.credit.name)}</a>
          {" "}(
          {demo.credit.licenseHref ? <a href={demo.credit.licenseHref}>{demo.credit.license}</a> : demo.credit.license}
          )
        </span>
      ))}. Overlays labelled Sample · recorded SAM output.
    </p>
  );
}
