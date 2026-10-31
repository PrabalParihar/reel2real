# Reel2Real

Phone-on-a-stand browser coach. Upload a short tutorial you filmed. Muse Spark writes steps JSON once. SAM 3.1 checks 2–4 objects on keyframes while each step keeps the creator segment and credit.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Routes: `/` landing, `/upload`, `/extracting`, `/coach`, `/done`.

## Environment

Names only. Never commit values, and never print them.

- `META_MODEL_API_KEY`
- `MODEL_API_KEY` (used only if `META_MODEL_API_KEY` is unset)

If neither is set, Spark and SAM use the mock clients. The UI shows a Mock chip. Sample tutorials stay labelled Sample.

The real client calls `POST https://api.meta.ai/v1/responses` with `muse-spark-1.3` and `sam-3.1`. Muse Image is not used.

## Models

| Model | Id | When |
| --- | --- | --- |
| Muse Spark | `muse-spark-1.3` | Once, while extracting steps |
| SAM 3.1 | `sam-3.1` | Every 1–2s keyframe in the coach |

Gate 0 (reported, not re-run here): median time to first mask 922 ms on a still and 2213 ms on a 2s chunk. 2213 ms is over the 2000 ms live threshold, so the default is **Keyframe mode**. Chunk tracking is optional. Above 5000 ms, or a timeout, the fallback is stills-only. Flip `runtimeHints.preferredLiveMode` to `stills_only` and the coach shows **Stills mode · Sample**. Same steps schema either way.

Spark was reported around 6–9 seconds. `/extracting` keeps a progress state for that wait and shows the measured elapsed time for the current run.

## Tests

```bash
npm test
```

## Gate 0 harness

Pass a local clip. The harness does not print the API key. With no key it uses the mock client and labels the decision `unverified_mock`.

```bash
npm run gate0 -- clips/your-clip.mp4
```

`clips/` is gitignored. Do not commit video or audio.

## Sample data

Fixtures in `src/fixtures/` are labelled Sample and point at placeholder paths. No creator media is in the repo. Filming notes are in `docs/demo-script.md`. Gate 0 missed a cup that was out of frame. The coach shows a hint when an expected object is not masked.

## Safety rule

On the chai cup step, and on the aloo jeera “knife down” step, a knife that is not required for the step raises `safety_halt`. Next stays disabled until Retry.
