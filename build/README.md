# Sample demo drop-in

Each folder here is one Sample demo, ready to copy.

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

Copy the folder to `public/samples/<slug>/` and delete `meta.json` from that public copy. The app serves files from `public/`. `meta.json` stays in this folder and is folded into the catalog entry in `src/samples/demos.ts` (credit, licence link, domain, safety note).

Then rebuild the box list and add the catalog entry. `docs/ADD-A-DEMO.md` has the steps. `fitDemo` chooses the frame. Do not hand-tune crops, and do not draw a box the sam file does not contain.

An empty `sam/step-N.json` is a step with no recorded highlight. The coach still shows that step's text.
