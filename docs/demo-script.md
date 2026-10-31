# Demo script

Film with a phone on a stand. Default coaching mode is **Keyframe mode**. The honesty chip stays on screen. Sample footage is labelled Sample.

## Framing

Gate 0 missed the cup because it was out of frame. SAM only masks what the camera can see. Before every step, put all 2–4 tracked objects fully inside the frame: not cropped by the edge, not hidden in a hand, not behind the mortar.

If the coach says a noun is not masked, stop and reframe. Do not keep going and hope the next keyframe guesses it.

## Setup

- Phone on a stand, lens aimed at the board. Browser open on the coach.
- Record the laptop or the phone screen for the demo video.
- Light from the side. Avoid a bright window behind the board.
- Leave the mode on Keyframe. Chunk mode is optional. Gate 0 measured 2213 ms to the first mask on a 2 second chunk, over the 2000 ms live threshold. A still was 922 ms.
- Hands and props only, unless you have consent for a face.
- Upload a clip you filmed. Do not paste an Instagram link. There is no fetch field.

## Masala chai (primary)

Self-filmed Sample. Placeholder path in the repo: `placeholders/sample-masala-chai.mp4`. Do not commit the video. Keep the real file in `clips/`.

1. Mortar, pestle, and ginger, all fully visible.
2. Crush ginger and cardamom in the mortar. Four objects, all inside the frame.
3. Set the cup beside the mortar. The whole cup stays in frame. This is the step Gate 0 failed when the cup was cropped. A knife in this step is the safety halt. Move it off the board and press Retry. Do not expect Next to skip safety.

## Bike chain (second, if time)

Wheel, chain, and rag in frame, then wipe, then oil one link with the rag off the chain.

## Shot list

1. Upload and the Spark progress capsules. Hold long enough to see the wait. Live Spark was reported around 6–9 seconds.
2. Coach with the Keyframe mode chip, Sample chip, and model ids `muse-spark-1.3` and `sam-3.1`.
3. Masks on the objects that are actually in frame.
4. Move one required object out. Wait for the hint, then the Skip chip. The missed step’s credit stays on screen. Press Skip only when you mean to leave the step.
5. Bring the next step’s object in early and wait for Out of order.
6. On the cup step, leave a knife in frame and show the safety chip. Clear it, then Retry.
7. Done screen with the step, skip, and safety counts, plus the model ids.

## Before you roll

- Point at each noun and confirm it is fully visible.
- The chip reads Keyframe mode.
- If the chip reads Mock, the masks are the local stand-in, not SAM. Film the judging take with `META_MODEL_API_KEY` set on your machine.
- Aim for a short demo. Check the portal’s length field before upload. This repo does not invent that limit.
