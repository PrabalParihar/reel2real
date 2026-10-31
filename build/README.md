# Sample demo drop-in

Each folder is one Sample demo, in the same shape as `public/samples/masala-chai/`, plus a `meta.json`.

```
build/<slug>/
  hero-loop.mp4
  hero.jpg
  step-1.jpg
  step-2.jpg
  step-3.jpg
  steps.json
  sam/step-1.json
  sam/step-2.json
  sam/step-3.json
  meta.json
```

Copy the folder to `public/samples/<slug>/` and leave `meta.json` out of `public/`. The app serves files from `public/`. Fold the credit, the licence link, and any safety note from `meta.json` into one `defineDemo` entry in `src/samples/demos.ts`.

Then rebuild the box list:

```bash
npx tsx scripts/sync-sample-boxes.ts
```

`fitDemo` chooses 4:5, 1:1, or 5:4 from those boxes. Do not paste crops into a screen, and do not draw a box the sam file does not contain. See `docs/ADD-A-DEMO.md`.
