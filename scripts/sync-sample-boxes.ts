import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { highlightedBoxes } from "../src/samples/boxes";
import type { SampleScene } from "../src/samples/scene";

const root = process.cwd();
const samplesDir = path.join(root, "public/samples");
const outFile = path.join(root, "src/samples/recorded-boxes.json");

function readJson(file: string): unknown {
  const text = readFileSync(file, "utf8").trim();
  if (!text) return {};
  return JSON.parse(text) as unknown;
}

const slugs = readdirSync(samplesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((slug) => {
    try {
      readFileSync(path.join(samplesDir, slug, "steps.json"));
      return true;
    } catch {
      return false;
    }
  })
  .sort();

const recorded: Record<string, ReturnType<typeof highlightedBoxes>> = {};
for (const slug of slugs) {
  const scene = readJson(path.join(samplesDir, slug, "steps.json")) as SampleScene;
  const files: Record<string, unknown> = {};
  for (const step of scene.steps) {
    const filePath = path.join(samplesDir, slug, step.samFile);
    try {
      files[step.samFile] = readJson(filePath);
    } catch {
      files[step.samFile] = {};
    }
  }
  recorded[slug] = highlightedBoxes(scene, files);
}

writeFileSync(outFile, `${JSON.stringify(recorded, null, 2)}\n`);
console.log(`wrote ${path.relative(root, outFile)} for ${slugs.join(", ")}`);
