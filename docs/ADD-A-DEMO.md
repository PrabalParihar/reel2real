# Add a Sample demo

The landing, demos section, coach, and done screen read `DEMOS` in `src/samples/demos.ts`. A new reel is one entry plus files. No screen code changes.

1. Add `public/samples/<slug>/` with `hero-loop.mp4`, `hero.jpg`, `step-1.jpg` … `step-N.jpg`, `steps.json`, and `sam/step-N.json`.
2. Keep `steps.json` in the same shape as masala chai: title, hero, steps with nouns, colours, keyframes, and `samFile`.
3. Append one object to `DEMOS`:
   - `slug` matches the folder name
   - `title`, `domain`, `clip`, `poster`
   - `credit` with the creator name, licence, and source URL
   - `scene` imported from that `steps.json`
   - `crop`, `zoom`, and `stepCrops`: object-position (`x` and `y` from 0 to 1) for the 5:4 phone. `zoom` stays 1. A lower zoom letterboxes the 16:9 clip inside the frame.
4. Mention the clip in `public/samples/CREDITS.md`.

`objectPositionForPoint` in `src/samples/mask-geometry.ts` turns a frame focal point into that crop for a 5:4 stage (`viewW / viewH = 1.25`). The mask overlay uses the same cover math against the rendered box, so the contour follows the crop. If a 5:4 cover cannot hold the nouns, widen the phone. Do not letterbox.
