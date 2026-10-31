# DRAFT. Do not submit.

This is draft text for a hackathon submission. Nothing in this repo submits it. Edit it by hand before anyone sends it.

## Name

Reel2Real

## One-liner

Put the phone on a stand, upload a short tutorial, and follow each step while the objects light up on camera.

## Problem

A tutorial video keeps playing while your hands are busy. It is easy to lose the object the step is about, and easy to move on before the frame actually matches. Pausing, scrubbing, and guessing which thing the narrator means breaks the lesson.

## What it does

Reel2Real is a browser coach. You upload a clip you filmed. Muse Spark turns that clip into a short list of steps. SAM 3.1 then checks a few objects on keyframes from the laptop or phone camera and draws a highlight when it sees them.

If a highlight does not come back, the stage says Highlights unavailable. Next still moves the step. The app does not invent a box.

Five Sample demos ship with recorded SAM output so a judge can watch the coach without spending a live call: masala chai, a kids science flask, origami, seed planting, and latte art. Those outlines are labelled Sample · recorded SAM output. They are not marked Live. The flask demo is for kids science. The card and the coach show Grown-up supervision, and the steps describe only what is visible.

The landing hero stays on the chai demo. Every demo card credits the creator, with the source page and the licence.

## How it uses Meta models

| Model | Id | Role |
| --- | --- | --- |
| Muse Spark | `muse-spark-1.3` | Once, when a clip is extracted into steps JSON |
| SAM 3.1 | `sam-3.1` | On coach keyframes, for the objects in the current step |

Both go through the app server to `POST https://api.meta.ai/v1/responses`. The browser does not hold the model key. `/api/spark` extracts steps. `/api/segment` requests a SAM mask. Sample demos do not call those routes for their saved outlines. They replay masks that were recorded from SAM 3.1 earlier.

Muse Image is not used.

The default coach mode is keyframe stills. A short video chunk was measured slower than the live budget, so chunk tracking stays optional.

## Tech

Next.js app, Node 22, deployed as a web service on Railway. Steps are validated against a JSON schema. Sample scenes, crops, and credits are data in `src/samples/demos.ts` plus files under `public/samples/`. Preview pages can sit behind a password. Secrets stay in environment variables and are not written into the repo.

## What's next

- More Sample reels added as data, without a screen rewrite.
- A tighter live loop when SAM answers inside the keyframe budget.
- A clearer path for a teacher to load a class clip and keep the credit on every step.

DRAFT. Do not submit.
