"use client";

import { PUBLISHED_SAMPLES } from "@/src/domains/catalog";
import { shapeClass } from "@/src/samples/frame-fit";
import { presentNouns, recordedFrameFile, sceneAsset } from "@/src/samples/scene";
import { PhotoFrame } from "./PhotoFrame";

const CHAI = PUBLISHED_SAMPLES.find((sample) => sample.id === "masala-chai") ?? PUBLISHED_SAMPLES[0];

/** Recorded chai step 1 still, with the existing SAM overlay. Nothing is redrawn. */
export function SampleCoachStill() {
  const scene = CHAI.scene;
  const step = scene.steps[0];
  const full = CHAI.stepFullFrame[0] === true;
  const nouns = presentNouns(step).filter((noun) => noun.verified !== false);
  return (
    <figure className="sample-coach">
      <div className={`reel-phone ${full ? "is-source" : shapeClass(CHAI.shape)}`}>
        <PhotoFrame
          className="is-fill"
          src={sceneAsset(scene, recordedFrameFile(scene, 0))}
          alt="Sample still of the mortar and pestle"
          sizes="(max-width: 800px) 100vw, 560px"
          objectPosition={full ? { x: 0.5, y: 0.5 } : CHAI.stepCrops[0] ?? CHAI.crop}
          zoom={full ? 1 : CHAI.stepZooms[0] ?? CHAI.zoom}
          sampleChip
          overlay={nouns.length ? { samUrl: sceneAsset(scene, step.samFile), nouns } : null}
        />
      </div>
      <figcaption>{step.instruction}</figcaption>
    </figure>
  );
}
