# Reel2Real

Reel2Real is a phone-on-a-stand browser guide. Upload a short tutorial you own or have permission to use, get a step plan, and use camera keyframes to highlight the objects for each step. Instruction mode instead starts from a goal and one workspace still. Object visibility does not verify that an action was performed correctly, its temporal order, or general safety. Next records the learner's confirmation.

Five recorded Sample demos are included: masala chai, a kids science flask, origami, seed planting, and latte art. They use saved instructions, media, creator credits, and recorded SAM output. They work without a model key or camera and never stand in for live acceptance evidence.

## Setup

Use Node 22 (`.nvmrc`: `22`; `engines.node`: `>=22 <23`). Railpack reads `engines.node` before `.nvmrc`.

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>. Routes: `/`, `/upload`, `/instruct`, `/extracting`, `/coach`, `/done`. Camera access needs HTTPS outside localhost and a compatible phone or laptop browser. Container format alone does not guarantee that a browser can decode the clip's codec.

Without live configuration, use the recorded Sample links. Public live routes are **off by default**, including when a model key alone is present. Runtime preflight describes configured capabilities, not provider health or quality. An unavailable or invalid preflight keeps live entry disabled; recorded Samples remain available.

## Environment and execution modes

Names and nonsecret switches only. Store keys and passwords in the environment's secret manager; never commit or print their values. Next.js also reads gitignored `.env.local` for local development.

| Name | Purpose |
| --- | --- |
| `META_MODEL_API_KEY` | Server-side Meta credential; preferred over `MODEL_API_KEY`. Default provider destination: `api.meta.ai`. |
| `MODEL_API_KEY` | Legacy fallback when the preferred key is missing or blank. |
| `META_DIRECT_ENABLED` | Exactly `1` opts public routes into single-service direct calls, and requires a nonblank configured model key. A real usable key is required for live success. |
| `SAM_FORWARD_ENABLED` | Exactly `1` selects valid configured SAM forwarding before direct mode. |
| `MUSE_FORWARD_ENABLED` | Exactly `1` selects valid configured Spark/Instruction forwarding before direct mode. |
| `SAM_FORWARD_URL` | Worker segment URL shared by forwarding routes; see [forwarding runbook](docs/SAM-FORWARD.md). |
| `SAM_FORWARD_SECRET` | Server-only shared secret for authenticated internal worker routes. |
| `PREVIEW_PASSWORD` | Optional HTTP Basic auth. Unset: open preview. Empty: gated routes return 503. Nonempty: any username with this password. |
| `META_DAILY_CALL_CAP` | Default 200 outbound provider-call attempts per UTC day **per process**, including file uploads and per-noun calls. |
| `META_API_BASE` | Optional Responses base; default `https://api.meta.ai/v1`. The Files API remains `https://api.meta.ai/v1/files`. Configure only a trusted intended provider destination. |
| `NEXT_PUBLIC_SAM_MIN_INTERVAL_MS` | Default 2000 ms between segment-request starts; at most one active browser request. |
| `NEXT_PUBLIC_SAM_STEP_CAP` | Default 3 segment requests per step allowance. Recheck resets this allowance, not the session/day/rate budgets. |
| `NEXT_PUBLIC_SAM_SESSION_CAP` | Default 60 segment requests in the current coach session. Exhaustion stops checks with visible manual/recorded recovery. |

`NEXT_PUBLIC_*` values are public client build configuration; they must never contain secrets. Rebuild when changing them for production.

The public route decision is made separately for Spark, Instruction and SAM:

1. A valid enabled forward wins for that route: HTTP(S) worker URL without embedded credentials, shared secret, and the route's exact `1` flag. Muse forwarding additionally requires the worker URL to end in `/api/internal/segment` without a query or fragment.
2. Otherwise `META_DIRECT_ENABLED=1` plus a configured key selects direct execution.
3. Otherwise that route is off and returns a degraded response. It does not silently make public mock/live calls. Recorded Sample requests are explicitly local, even when live execution is configured.

A selected forward that fails does not retry directly. A malformed/disabled forward does not select forwarding; an independently enabled direct configuration may still be selected by step 2. See [model execution](src/server/model-execution.ts) and [runtime response](src/server/env.ts). `/api/runtime` exposes model IDs, configured capabilities and execution modes; it never returns credentials. Its legacy `mock` field is not proof of the provenance of a particular result. UI Live/Mock/Sample/Cached labels follow result provenance.

For one web service, provide `META_MODEL_API_KEY` securely and explicitly enable `META_DIRECT_ENABLED`; leave forwarding flags off. For a frontend plus worker, follow [SAM-FORWARD.md](docs/SAM-FORWARD.md). Configuration alone is not a successful provider call.

## Models, media and budgets

The browser calls same-origin app routes; it never holds the model key.

| Model | ID | Role |
| --- | --- | --- |
| Muse Spark | `muse-spark-1.3` | `/api/spark`: tutorial to validated plan; `/api/instruct`: goal plus workspace still to plan. |
| SAM 3.1 | `sam-3.1` | `/api/segment`: locate the current step's objects. Browser coaching captures JPEG keyframes. |

Muse Image is not used. Recorded Sample overlays come from files under `public/samples/<slug>/`, labelled `Sample · recorded SAM output`; they do not acquire a camera or poll `/api/segment`.

- Uploaded clips must be playable MP4/WebM, nonempty, **at most 16 MiB and 120 seconds**. Preparation checks signature and a decoded first frame, has a 15-second deadline, and offers cancellation. This is not universal codec support.
- Spark receives the **complete accepted clip**, never a silent first-two-second trim. Clips up to 10 seconds and 8 MiB use `input_video`; longer/larger accepted clips use Files upload and `input_file`. An inline HTTP 400/413 can retry through Files using the same complete input. The JSON body ceiling is 32 MiB. The Spark client has one 45-second deadline across upload, fallback, generation and complete response body. Muse forwarding has a 60-second transport ceiling; browser preparation transport remains bounded at 45 seconds.
- SAM accepts real JPEG/PNG/WebP images or MP4/WebM video inputs, at most **5 MiB raw media** inside an **8 MiB JSON body**. Browser coaching uses still images; the server/Gate 0 video path is not browser chunk capture. One shared deadline, clamped to **8 seconds total**, covers preparation, all sequential noun calls and response bodies. Up to four visual prompts are supported; precise `samPrompt` descriptions are retained. Invalid/incomplete upstream responses fail rather than establish object absence.
- Instruction goal length is at most 240 characters and workspace stills are limited to 2 MiB decoded. A still-based plan does not claim tutorial timestamps.
- Model routes share an app limit of 20 requests/minute/IP. This is not a Meta quota. One segment request can make one provider response call per noun; three nouns mean up to three calls. Retries and file uploads also consume the per-process daily budget. Forwarding has separate frontend/worker process counters. Process restarts, multiple services and shared venue networks need operational budget planning.

Historical benchmark numbers are not a current service guarantee. Gate 0 now measures complete multi-noun request timing, not time to the first streamed mask. It does not establish relevant boxes, complete lesson coverage or real-device usability.

## Recovery, provenance and media handling

Camera denial/unavailability and failed object checks permit manual Next/Skip except during the specific configured safety halt. Recheck objects renews the current step's request allowance while preserving broader budgets. Expired/failed evidence is cleared or labelled as a previous check; it cannot silently verify a new step. Voice on/off is an ordinary control. Mobile instructions, hints and supervision notes remain available.

Recaps distinguish **You confirmed**, **Objects visible**, **Skipped** and **Unvisited**. A jump is not completion. These outcomes do not certify technique or general safety. Cold/interrupted Coach and Done routes offer recovery instead of inventing a completed run.

File inspection and hashing start locally. Continuing sends the complete clip and supplied details through the app server to the configured model service; live checks send workspace frames. File-based Spark requests upload to Meta's Files API. This repository does not establish provider retention or deletion guarantees.

Validated plans, metadata and execution provenance can be saved in this browser's IndexedDB for up to seven days of cache eligibility. Cache failure does not block a usable plan; Clear saved lessons is available in Upload. A cache entry must match the clip and current request metadata. Daily-cap recovery uses a matching cache entry or offers an **explicit** recorded Sample with its own media and credits; it never silently substitutes an unrelated tutorial with uploader attribution. Upload drafts are session state, not a durable cross-refresh checkpoint.

Instagram preview is optional reference viewing. A pasted URL does not fetch a tutorial for extraction, and no share-target workflow is promised. Upload only footage you own or are permitted to use.

## Add a demo

Demos are data in `src/samples/demos.ts`; screens read `DEMOS` through the published catalog.

1. Put the reel in `public/samples/<slug>/` (`hero-loop.mp4`, `hero.jpg`, `step-N.jpg`, `steps.json`, `sam/step-N.json`). Keep `meta.json` out of `public/`. The drop-in folder is `build/<slug>/`.
2. Run `npx tsx scripts/sync-sample-boxes.ts` so fit uses the recorded boxes.
3. Add one `defineDemo` entry: slug, domain, scene, creator/source/licence/licence-link credit, and `safetyNote` when needed.
4. Add the creator to [CREDITS.md](public/samples/CREDITS.md) and verify the asset's applicable rights/permission record before submission. Existing rights policy is in [legal/README.md](legal/README.md); do not describe third-party stock footage as self-filmed.

`fitDemo` picks the narrowest of 4:5, 1:1 and 5:4 that holds every step with a 4% margin. Grid cards stay 4:5. Cards draw outlines only when every box fits; otherwise they show the cover and tags. See [ADD-A-DEMO.md](docs/ADD-A-DEMO.md).

Published order: masala-chai, flask-colour, origami, seed-planting, latte-art. The goal preview uses the chai sample. The flask-colour demo is kids science: retain **Grown-up supervision**, name only visible content, and do not add chemical identities. Published chai does not claim a cup, ginger or cardamom. The legacy aloo-jeera fixture has a targeted knife-prop halt; Next remains blocked until Retry. These are limited fixture rules, not a general safety assessment.

The [Designeer-inspired design](docs/design-reference.md) uses a light lesson gallery with real category filters and a scoped studio appearance for non-camera screens. [Design QA](design-qa.md) preserves its historical checkpoint; see the [Railway launch observations](docs/railway-launch.md) and [current competition/task board](docs/competitive-readiness.md) for newer evidence. The deployed app's recorded flows work. Public live goal planning, generated-clip planning (inline and Files API) and a synthetic red-box SAM check pass through manually pinned worker `234f32a`. Across five successful SAM responses, all three restored-frame checks missed blue and both absent-frame checks were correct. Useful missing-object correction remains P0. See the linked launch/task board for evidence and the manual worker/key-update requirements. Physical phones, owned real-demo footage and learner acceptance remain open.

[demo-script.md](docs/demo-script.md) and [SUBMISSION-DRAFT.md](docs/SUBMISSION-DRAFT.md) are **drafts, not submitted**. [Official event requirements](docs/event-requirements.md) were checked on 2026-11-02: the stated submission deadline is **November 5, 2026 at 07:30 IST**. The rubric weights Impact 30%, Meta tooling 25%, Technical Depth & Execution 20% and Demo 25%. Personal eligibility/acceptance, portal artifacts and project-specific prior-work questions remain unresolved. Reconcile the drafts with those requirements and actual hosted live evidence before filming/submission. Recorded clips and attribution stay labelled accurately.

## Tests

The media regression tests require `ffmpeg` and `ffprobe` on `PATH`. On Ubuntu, install the `ffmpeg` package; the CI workflow installs and checks both tools before running the suite. The hosted application does not require these test tools.

```bash
npm test
npm run build
```

Vitest uses fakes and recorded data, not Meta. Production build checks compilation; it does not prove provider health.

Browser regressions use `@playwright/test` 1.64.1. Install its Chromium locally, or use an installed compatible executable:

```bash
npx playwright install chromium
npm run test:e2e
```

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

The config starts the local development server at `127.0.0.1:3000` outside CI and uses `npm run start` when `CI` is set, so build first for the production test path. It can reuse an existing local server outside CI. `PLAYWRIGHT_BASE_URL` changes the browser base URL; it does not suppress that local web-server configuration. Traces/screenshots are retained for failures. The checked-in browser suite covers provider-independent recorded and intercepted failure/recovery paths. It does not call real models or prove physical-device camera behavior. See [readiness and closure ledger](docs/hackathon-readiness.md) for dated results and remaining gates; do not infer a pass for every audit scenario from a green subset.

## Gate 0 harness

Gate 0 requires `ffprobe` and `ffmpeg` on PATH, an owned/permitted local MP4/WebM fixture of at most **5 MiB and 120 seconds**, and explicit attribution. The CLI runs three times. Its prompts are kitchen-specific; choose a suitable fixture and review relevance separately.

```bash
npm run gate0 -- clips/your-clip.mp4 --creator "Fixture creator" --licence self_filmed --runs 3
```

Use `permission_granted` only when that accurately describes your fixture. **Without `--live`, the harness always uses mocks, even if credentials exist**, and reports `unverified_mock`. An intentionally credentialed run adds `--live`; this opt-in is independent of the public HTTP `META_DIRECT_ENABLED` gate. Supply the key securely through the process environment, never in a command argument or output.

Output includes `sam_still_full_ms` and `sam_clip_full_ms`: total multi-noun request completion including response body. **First streamed mask is not measured.** Each run can attempt up to five SAM response calls plus Spark inline/file/fallback calls, subject to the process cap. A schema-valid plan and nonempty masks are not proof of action coverage or box relevance. Keep live results separate from mock output and browser capture-to-overlay timing. `clips/` is gitignored; do not commit video/audio outside the approved sample/build asset locations.

## Deployment and remaining readiness

This is a Node web service: `npm run build`, then `npm run start`. `next start` listens on `PORT` (default 3000). [railway.json](railway.json) supplies Railpack build/start commands; it has no health-check path. Verify platform body/time limits support the documented app limits.

Basic auth covers normal pages/API routes. Sample assets, image/static paths and icons remain public. The three exact `/api/internal/segment`, `/api/internal/spark` and `/api/internal/instruct` paths bypass Basic auth but enforce the shared worker secret. Plan judge access deliberately; do not treat `/api/runtime` as a health check.

See [hackathon-readiness.md](docs/hackathon-readiness.md) for configuration, deployment rehearsal, audit closure and open acceptance gates. On 2026-11-02 the managed environment reported current enforced unrestricted HTTP access and ready `META_MODEL_API_KEY` and `META_DIRECT_ENABLED` bindings; the official event page and linked rules were reachable. These observations supersede earlier blocked-domain/unapplied-draft notes and do not prove provider authorization or output quality. A real hosted live loop, physical-phone testing, learner validation and confirmed participant/portal requirements remain necessary before making those claims.
