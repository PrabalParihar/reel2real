# Reel2Real

Phone-on-a-stand browser coach. Upload a short tutorial. Muse Spark turns the clip into steps once. SAM 3.1 checks 2–4 objects on keyframes. Credit and licence come from the form, not from the model.

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
- `PREVIEW_PASSWORD` (optional basic auth; an empty value closes the preview)
- `META_DAILY_CALL_CAP` (optional, default 200 Meta calls per UTC day in this process)
- `META_API_BASE` (optional, default `https://api.meta.ai/v1`)
- `NEXT_PUBLIC_SAM_MIN_INTERVAL_MS` (optional, default 2000). The coach will not start a second SAM call until this gap has passed, and it keeps at most one call in flight.
- `NEXT_PUBLIC_SAM_SESSION_CAP` (optional, default 60). After that many coach calls, polling stops and the stage shows Highlights paused. Next still moves the step.

Node 22 is pinned with `.nvmrc` (`22`) and `package.json` `engines.node` `>=22 <23`. Railpack reads `engines.node` before `.nvmrc`.

If neither model key is set, Spark and SAM use the mock clients. The UI shows a Mock chip. Sample tutorials stay labelled Sample.

The real client calls `POST https://api.meta.ai/v1/responses` with `muse-spark-1.3` and `sam-3.1`. SAM sends `stream: true`, `metadata.mask_encoding` `one_bit`, and `Accept: text/event-stream`, which is the still request in the [segmenting guide](https://dev.meta.ai/docs/sam/segmenting). A missing `META_API_BASE` stays on `https://api.meta.ai/v1`. A failed SAM call logs the upstream status and path only. If highlights never arrive, Next and Skip still move the step and the stage shows Highlights unavailable. A clip of about 10 seconds or less is sent as a 2 second `input_video` data URL. A longer clip, or a payload over 8 MB, is uploaded with `POST https://api.meta.ai/v1/files` (`purpose=user_data`) and referenced as an `input_file` `file_id`, which is the shape in the file-handling guide. If both fail, the API returns an error and does not invent steps. A transcript is only the fallback when no clip is sent. Muse Image is not used.

`/api/spark` and `/api/segment` allow 20 requests per minute per IP. That limit is ours, not a Meta quota. The daily cap counts outbound Meta calls in process memory and answers 429 when it is spent. The UI then shows cached steps for that file, or a Sample tutorial, with a chip that says the cap was reached.

## Models

| Model | Id | When |
| --- | --- | --- |
| Muse Spark | `muse-spark-1.3` | Once, while extracting steps |
| SAM 3.1 | `sam-3.1` | Every 1–2s keyframe in the coach |

Gate 0 (reported, not re-run here): median time to first box 922 ms on a still and 2213 ms on a 2s chunk. 2213 ms is over the 2000 ms live threshold, so the default is **Keyframe mode**. Chunk tracking is optional. Above 5000 ms, or a timeout, the fallback is stills-only. Flip `runtimeHints.preferredLiveMode` to `stills_only` and the coach shows **Stills mode · Sample**. Same steps schema either way.

A verified 2 second Spark clip took about 16.7 seconds median (3 runs, HTTP 200, schema-valid, 3 steps). Text-only Spark was reported around 6–9 seconds. `/extracting` shows the stages that actually happen and the elapsed time for this run. It does not draw a percentage. The same clip hash (SHA-256 of the file bytes) is cached in this browser, and a replay shows a Cached chip.

## Railway

This app is a Node web service. `npm run build` then `npm run start`. `next start` listens on `PORT` (default 3000). Node is `>=22 <23` in `engines`, and `.nvmrc` says `22`. `railway.json` sets the Railpack build command and the start command.

Set the model key and, for a public preview, `PREVIEW_PASSWORD`. Basic auth then covers every route, including `/_next/static` and files in `public`, because middleware is registered without a matcher that excludes them. An empty `PREVIEW_PASSWORD` returns 503 on every route. Sign in as any username with that password. There is no health-check path in `railway.json`, because a check would also have to send the password.

Docs used: [Next.js Node.js server deployment](https://nextjs.org/docs/app/building-your-application/deploying#nodejs-server), [Next.js CLI `next start` port](https://nextjs.org/docs/app/api-reference/cli/next#next-start-options), [Next.js middleware](https://nextjs.org/docs/app/api-reference/file-conventions/middleware), [Railway config as code](https://docs.railway.com/reference/config-as-code), [Railway start command](https://docs.railway.com/guides/start-command). The Railway variables reference lists `RAILWAY_*` names and does not list an HTTP `PORT` key. `next start` still reads `PORT` when the platform sets it.

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

Published Sample steps, keyframes, and recorded SAM masks live in `public/samples/`. Titles and nouns come from each demo's `steps.json`. Filming notes are in `docs/demo-script.md`. The coach shows a hint when an expected object is not highlighted. A step with no recorded hit shows that honestly and does not invent a box.

## Safety rule

On the aloo jeera knife-down step, a knife that is not required for the step raises `safety_halt`. Next stays disabled until Retry. The published chai sample does not claim a cup, ginger, or cardamom.
