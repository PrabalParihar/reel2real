# Add a Sample demo

The landing, demos section, coach, and done screen read `DEMOS` in `src/samples/demos.ts`. A new reel is one entry plus files. No screen code changes.

1. Add `public/samples/<slug>/` with `hero-loop.mp4`, `hero.jpg`, `step-1.jpg` … `step-N.jpg`, `steps.json`, and `sam/step-N.json`.
2. Keep `steps.json` in the same shape as masala chai: title, hero, steps with nouns, colours, keyframes, and `samFile`.
3. Append one object to `DEMOS`:
   - `slug` matches the folder name
   - `title`, `domain`, `clip`, `poster`
   - `credit` with the creator name, licence, and source URL
   - `scene` imported from that `steps.json`
   - `boxes`: the highlighted mask boxes from each `sam/step-N.json`, in record order
   - Leave `shape`, `crop`, `zoom`, `stepCrops`, and `stepZooms` to `fitDemo` in `src/samples/frame-fit.ts`. It picks the narrowest of 4:5, 1:1, and 5:4 that holds every step with margin. Zoom stays at 1 unless the fit needs more. Do not letterbox.
4. Mention the clip in `public/samples/CREDITS.md`.

Demo grid cards stay 4:5 even when the phone is wider. `fitDemo` turns card outlines off when those boxes do not fit that card.
