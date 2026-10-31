# Reel2Real

Reel2Real is a phone-on-a-stand browser coach. Upload a short tutorial you filmed. The app turns that clip into steps, then highlights the objects in each step while you follow along on camera.

Five Sample demos are included so the coach can be shown from recorded output: masala chai, flask colour, origami, seed planting, and latte art. The landing hero stays on masala chai. Sample outlines are labelled `Sample · recorded SAM output`. They are never labelled Live.

The team is Prabal Pratap Singh, Nikhil Verma, and Neha Singh. The planned track is Indie Developer. A draft write-up is in `docs/SUBMISSION-DRAFT.md`. Do not submit it from this repo.

## Setup

Node 22. `.nvmrc` is `22`. `package.json` `engines.node` is `>=22 <23`. Railpack reads `engines.node` before `.nvmrc`.

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
- `PREVIEW_PASSWORD` (optional basic auth; an empty value closes the preview)
- `META_DAILY_CALL_CAP` (optional, default 200 Meta calls per UTC day in this process)
- `META_API_BASE` (optional, default `https://api.meta.ai/v1`)
- `NEXT_PUBLIC_SAM_MIN_INTERVAL_MS` (optional, default 2000). The coach will not start a second SAM call until this gap has passed, and it keeps at most one call in flight.
- `NEXT_PUBLIC_SAM_SESSION_CAP` (optional, default 60). After that many coach calls, polling stops and the stage shows Highlights paused. Next still moves the step.
If neither model key is set, Spark and SAM use the mock clients. The UI shows a Mock chip. Sample tutorials stay labelled Sample.

## Architecture

This is a Next.js app. The browser talks to same-origin routes. It does not call Meta directly.

- `/api/spark` runs once, while steps are extracted. It calls Muse Spark (`muse-spark-1.3`).
- `/api/segment` is the server route for live highlights. The browser never holds the model key. The public app accepts the same-origin request, then sends it through a private, authenticated server-side forward to a worker service on the host's private network. That worker calls SAM 3.1 (`sam-3.1`) and returns the result.
- Live model calls use `POST https://api.meta.ai/v1/responses`.
- Sample demos do not use that live path for their outlines. Each demo is a folder of stills plus recorded SAM output under `public/samples/<slug>/`. The label on those outlines is `Sample · recorded SAM output`.
- If the forward or the Meta call fails, Next and Skip still move the step and the stage shows Highlights unavailable. The app does not invent a box.

`/api/spark` and `/api/segment` allow 20 requests per minute per IP. That limit is ours, not a Meta quota. The daily cap counts outbound Meta calls in process memory and answers 429 when it is spent. The UI then shows cached steps for that file, or a Sample tutorial, with a chip that says the cap was reached.

Some Sample steps show no outline. The recorded masks for those steps failed verification (size and position checks), so the step shows a plain hint instead of a guessed outline, and it does not show a Sample chip that would imply a highlight. On current main that includes latte art steps 1 and 3, masala chai step 3, and origami step 3. Other steps keep only the masks that passed. Chai step 2 keeps the hand. Flask step 3 keeps the flask.

## Models

| Model | Id | How it is used |
| --- | --- | --- |
| Muse Spark | `muse-spark-1.3` | Once, while extracting steps from a clip you upload |
| SAM 3.1 | `sam-3.1` | Live coach keyframes, about every 1 to 2 seconds, for 2 to 4 objects. Sample demos replay masks recorded from this model |

Muse Image is not used.

The real client calls `POST https://api.meta.ai/v1/responses`. SAM sends `stream: true`, `metadata.mask_encoding` `one_bit`, and `Accept: text/event-stream`, which is the still request in the [segmenting guide](https://dev.meta.ai/docs/sam/segmenting). A missing `META_API_BASE` stays on `https://api.meta.ai/v1`. A failed SAM call logs the upstream status and path only. A clip of about 10 seconds or less is sent as a 2 second `input_video` data URL. A longer clip, or a payload over 8 MB, is uploaded with `POST https://api.meta.ai/v1/files` (`purpose=user_data`) and referenced as an `input_file` `file_id`. If both fail, the API returns an error and does not invent steps. A transcript is only the fallback when no clip is sent.

Gate 0 (reported, not re-run here): median time to first box 922 ms on a still and 2213 ms on a 2 second chunk. 2213 ms is over the 2000 ms live threshold, so the default is **Keyframe mode**. Chunk tracking is optional. Above 5000 ms, or a timeout, the fallback is stills-only. Flip `runtimeHints.preferredLiveMode` to `stills_only` and the coach shows **Stills mode · Sample**. Same steps schema either way.

A verified 2 second Spark clip took about 16.7 seconds median (3 runs, HTTP 200, schema-valid, 3 steps). Text-only Spark was reported around 6 to 9 seconds. `/extracting` shows the stages that actually happen and the elapsed time for this run. It does not draw a percentage. The same clip hash (SHA-256 of the file bytes) is cached in this browser, and a replay shows a Cached chip.

## Add a demo

Demos are data. Screens read `DEMOS` in `src/samples/demos.ts`.

1. Put the reel in `public/samples/<slug>/` (`hero-loop.mp4`, `hero.jpg`, `step-N.jpg`, `steps.json`, `sam/step-N.json`). Keep `meta.json` out of `public/`. The drop-in folder is `build/<slug>/`.
2. Run `npx tsx scripts/sync-sample-boxes.ts` so the fit uses the recorded boxes.
3. Add one `defineDemo` entry: slug, domain, scene, credit (creator, source URL, licence, licence link), and `safetyNote` when the demo needs one.
4. Add the creator to `public/samples/CREDITS.md`.

`fitDemo` picks the narrowest of 4:5, 1:1, and 5:4 that holds every step with a 4% margin. Grid cards stay 4:5. An outline is drawn on a card only when every box fits. Otherwise the card shows the cover and a tag row. Details are in `docs/ADD-A-DEMO.md`.

The flask-colour demo is kids science. Its steps name only what you can see. The card and the coach show Grown-up supervision. Do not add chemical names to that demo.

## Sample demos

Published order: masala-chai, flask-colour, origami, seed-planting, latte-art. Filming notes are in `docs/demo-script.md`. Prod is https://web-production-d1454.up.railway.app. A draft submission write-up is in `docs/SUBMISSION-DRAFT.md`. That file is a draft. Do not submit it from this repo.

Credits match `public/samples/CREDITS.md`:

| Demo | Clip | Author | Source | Licence |
| --- | --- | --- | --- | --- |
| masala-chai | chai-mortar-kitchen-5480225.mp4 | Pexels contributor | https://www.pexels.com/video/5480225/ | [Pexels License](https://www.pexels.com/license/) |
| flask-colour | hero-loop.mp4 | AlexKopeykin | https://pixabay.com/videos/chimie-ballon-chimique-laboratoire-53946/ | [Pixabay Content License](https://pixabay.com/service/license-summary/) |
| origami | hero-loop.mp4 | Yogendra Singh | https://www.pexels.com/video/a-person-making-origami-6364305/ | [Pexels License](https://www.pexels.com/license/) |
| seed-planting | hero-loop.mp4 | Tima Miroshnichenko | https://www.pexels.com/video/top-view-of-a-person-planting-seeds-6508485/ | [Pexels License](https://www.pexels.com/license/) |
| latte-art | hero-loop.mp4 | franklandgrave | https://mixkit.co/free-stock-video/latte-art-810/ | [Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree) |

The chai credit line is Pexels contributor. flask-colour shows Grown-up supervision and does not name a chemical. No Wikimedia CC BY-SA images are used in this Sample set.

## Railway

This app is a Node web service. `npm run build` then `npm run start`. `next start` listens on `PORT` (default 3000). Node is `>=22 <23` in `engines`, and `.nvmrc` says `22`. `railway.json` sets the Railpack build command and the start command.

Set the model key and, for a public preview, `PREVIEW_PASSWORD`. Basic auth covers pages and API routes. `/samples/*`, `/_next/image`, `/_next/static`, and the favicon stay public so the image optimizer can read the sample frames. An empty `PREVIEW_PASSWORD` returns 503 on gated routes. Sign in as any username with that password. There is no health-check path in `railway.json`, because a check would also have to send the password.

Docs used: [Next.js Node.js server deployment](https://nextjs.org/docs/app/building-your-application/deploying#nodejs-server), [Next.js CLI `next start` port](https://nextjs.org/docs/app/api-reference/cli/next#next-start-options), [Next.js middleware](https://nextjs.org/docs/app/api-reference/file-conventions/middleware), [Railway config as code](https://docs.railway.com/reference/config-as-code), [Railway start command](https://docs.railway.com/guides/start-command). The Railway variables reference lists `RAILWAY_*` names and does not list an HTTP `PORT` key. `next start` still reads `PORT` when the platform sets it.

## Tests

```bash
npm test
```

Tests do not call Meta.

## Gate 0 harness

Pass a local clip. The harness does not print the API key. With no key it uses the mock client and labels the decision `unverified_mock`.

```bash
npm run gate0 -- clips/your-clip.mp4
```

`clips/` is gitignored. Do not commit video or audio outside `public/samples/` and `build/`.

## Safety

On the aloo jeera knife-down step, a knife that is not required for the step raises `safety_halt`. Next stays disabled until Retry. The published chai sample does not claim a cup, ginger, or cardamom. flask-colour shows Grown-up supervision and does not name a chemical.
