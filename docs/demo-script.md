# Demo script

Film with a phone on a stand. Default coaching mode is **Keyframe mode**. The honesty chip stays on screen. Sample footage is labelled Sample.

## Run locally for filming

Use Node 22 (`.nvmrc` is `22`), then install dependencies.

```bash
npm i
```

There is no `.env.example`. Next.js reads `.env.local` for `npm run dev`, and `.env.*` is gitignored. Create `.env.local` in the repo root:

```
META_MODEL_API_KEY=<your key>
```

That value is a placeholder. Do not commit a real key.

`PREVIEW_PASSWORD` is optional locally. Leave it unset and every route stays open. An empty value returns 503 on every route. A non-empty value requires HTTP basic auth.

```bash
npm run dev
```

Open http://localhost:3000/coach. A new browser session has no tutorial yet, so the coach sends you to upload until you open a Sample.

Live SAM runs from the presenter's own machine.

## Framing

Gate 0 missed the cup because it was out of frame. SAM only boxes what the camera can see. Before every step, put all 2–4 tracked objects fully inside the frame: not cropped by the edge, not hidden in a hand, not behind the mortar.

If the coach says a noun is not highlighted, stop and reframe. Do not keep going and hope the next keyframe guesses it.

## Setup

- Phone on a stand, lens aimed at the board. Browser open on the coach.
- Record the laptop or the phone screen for the demo video.
- Light from the side. Avoid a bright window behind the board.
- Leave the mode on Keyframe. Chunk mode is optional. Gate 0 measured 2213 ms to the first box on a 2 second chunk, over the 2000 ms live threshold. A still was 922 ms.
- Hands and props only, unless you have consent for a face.
- Upload a clip you filmed. Do not paste an Instagram link. There is no fetch field.

## Masala chai (primary Sample)

Pexels mortar kitchen clip, one continuous scene. Keyframes live in `public/samples/masala-chai/`. Recorded overlays are labelled Sample · recorded SAM output.

1. Set out the mortar and pestle.
2. Crush the spice mix. Spices and a hand.
3. Drop dried herbs into the mortar.

## Bike chain (second Sample)

Same drivetrain clip throughout. Keyframes live in `public/samples/bike-chain/`. The landing card uses the chain frame.

1. Frame the bicycle chain.
2. Brush the drivetrain.
3. Steady the bike with your hand.

## Your own filming

Upload a clip you filmed. The coach uses the laptop camera when you allow it, and Sample keyframes only on the Sample runs above. If live SAM does not answer, the stage says Highlights unavailable. Next still moves the step.

## Shot list

1. Upload and the Spark progress capsules. Hold long enough to see the wait. Live Spark was reported around 6–9 seconds.
2. Coach with the Keyframe mode chip, Sample chip, and model ids `muse-spark-1.3` and `sam-3.1`.
3. Recorded Sample contours on the objects that are actually in the frame. Live highlights only when SAM returns them.
4. Move one required object out. Wait for the hint, then the Skip chip. The missed step’s credit stays on screen. Press Skip only when you mean to leave the step.
5. Bring the next step’s object in early and wait for Out of order.
6. Knife safety still lives on the aloo jeera fixture, not on the published chai sample. If you load that fixture, leave a knife in frame on the knife-down step, then Retry.
7. Done screen with the step, skip, and safety counts, plus the model ids.

## Before you roll

- Point at each noun and confirm it is fully visible.
- The chip reads Keyframe mode.
- If the chip reads Mock, the highlights are the local stand-in, not SAM. Film the judging take with `META_MODEL_API_KEY` set on your machine.
- Aim for a short demo. Check the portal’s length field before upload. This repo does not invent that limit.
