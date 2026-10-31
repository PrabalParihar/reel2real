# Add a Sample demo

The landing, demos section, coach, and done screen read `DEMOS` in `src/samples/demos.ts`. A new reel is one catalog entry plus files. No screen code changes.

1. Add `public/samples/<slug>/` with `hero-loop.mp4`, `hero.jpg`, `step-1.jpg` … `step-N.jpg`, `steps.json`, and `sam/step-N.json`. Leave `meta.json` out of `public/`. The drop-in copy, including `meta.json`, lives in `build/<slug>/`. See `build/README.md`.
2. Keep `steps.json` in the same shape as masala chai: title, hero, steps with nouns, colours, keyframes, and `samFile`. A step with an empty `sam/step-N.json` is allowed. The coach shows the step text and does not invent a mask.
3. Rebuild the box list from those files:

```bash
npx tsx scripts/sync-sample-boxes.ts
```

That writes `src/samples/recorded-boxes.json`. The catalog reads it. Do not paste coordinates into a screen.
4. Append one object to `DEMOS` with `defineDemo`:
   - `slug` matches the folder name and `steps.json` `demo`
   - `domain` is `indian_recipe`, `non_cooking_diy`, or `other`
   - `scene` is that `steps.json`
   - `credit` with the creator name, licence, source URL, and licence link from `meta.json`
   - `safetyNote` when the demo needs one. Kids science uses `Grown-up supervision`
   - Leave `shape`, `crop`, `zoom`, `stepCrops`, and `stepZooms` to `fitDemo` in `src/samples/frame-fit.ts`. It picks the narrowest of 4:5, 1:1, and 5:4 that holds every step with a 4% margin. Zoom stays at 1. Do not letterbox. If a demo cannot fit 5:4, the catalog test fails. Do not cut objects.
5. Mention the clip in `public/samples/CREDITS.md` with the source URL and the licence link.
6. Order in `DEMOS` is the order on the page. Masala chai stays first so the hero stays on chai.

Demo grid cards stay 4:5 even when the phone frame is wider. `fitDemo` turns card outlines off when those boxes do not fit that card. The card then shows the cover and a tag row. A cut outline is never drawn.

Swapping the files under `public/samples/<slug>/` and the matching catalog entry (credit, domain, safety note) does not require a screen change. Run the box sync after a mask file changes so the fit stays honest.
