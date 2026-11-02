# DRAFT. Demonstration script. Not filmed, not submitted.

This is a proposed filming plan. **Public goal, generated-clip (inline/Files) and red-box SAM checks pass. Restored-blue SAM false negatives leave useful correction and the physical-demo sequence below unverified.** [Official sources were refreshed November 3, 2026, Asia/Calcutta](event-requirements.md); submissions are due **November 5 at 07:30 IST**. Desired track is Indie Developer, with the stored application switch/acceptance still to confirm. Portal fields, video duration and project-specific rights/prior-work questions remain unresolved. The suggested 2-3 minute structure is an editing assumption, not an official limit. Complete the [priority gates](competitive-readiness.md) and live acceptance before filming. Nothing here publishes or submits this draft.

## Story and supported claims

Show one beginner following one short, safe tabletop lesson: owned clip → actual plan → learner camera → missing object/reframe → fresh Recheck → learner-confirmed recap. Spark supplies steps; SAM locates objects. Object presence does not prove that a fold, pour or other action was performed correctly, that actions occurred in the right order, or that the task is safe. Next is the learner's confirmation. Recorded Samples illustrate the concept and provide a labelled backup.

Use a simple permitted lesson with two or three visually distinct props, good light and no hazardous procedure. Include a meaningful action after second two so acceptance checks assess the complete lesson rather than only its opening. Do not choose unknown chemistry or knife work as the main live proof. Keep hands and props in frame; include a face only with consent.

## Setup for rehearsal

Use Node 22 and the lockfile:

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>. Camera access needs HTTPS outside localhost. For single-service live execution, securely bind `META_MODEL_API_KEY` and explicitly set `META_DIRECT_ENABLED=1`; a key alone leaves public direct calls off. For an intended worker deployment use [SAM-FORWARD.md](SAM-FORWARD.md). Do not print the key, put it in a command argument, or show environment screens on camera. Public `d3ee4b77` forwards to manually pinned worker `234f32a`; goal, generated-clip inline/Files and red-box SAM checks pass. Five SAM calls returned upstream200: all three restored-frame checks missed blue; both absent-frame checks were correct. Resolve that quality P0 and rehearse a useful physical-phone correction before filming. See [current evidence and gates](competitive-readiness.md) and [manual worker/key operations](railway-launch.md). Generated QA footage does not replace the owned physical lesson proposed below.

`PREVIEW_PASSWORD` is optional: unset leaves normal routes open; empty returns 503; nonempty requires Basic auth. Rehearse the exact submitted origin and judge access rather than assuming a local take establishes hosted readiness. `/api/runtime` reports configuration, not provider health.

Browser tutorial input is a playable MP4/WebM of at most **16 MiB and 120 seconds**. Spark receives the complete accepted clip: inline video for short/small input, otherwise Files upload/reference. It is not silently trimmed to two seconds. Camera coaching uses JPEG keyframes, not browser video-chunk tracking. Consult [readiness](hackathon-readiness.md) for timeouts, caps, privacy and remaining acceptance work.

## Evidence checklist before the final take

- [ ] Accepted-participant/waiver status, track, portal artifacts, actual video limit and any prior-work uncertainty resolved against [verified event requirements](event-requirements.md); draft revised accordingly.
- [ ] Submitted asset sources/licences/permissions and any face/voice consent verified; keep creator/source credit accurate. The existing stock inventory below is not self-filmed.
- [ ] Exact deployed build/origin and direct/forward mode recorded; real credential and network access available; no mock or intercepted response used for a live claim.
- [ ] Cold run uses fresh extraction, or cache provenance is visibly disclosed. Use Clear saved lessons when a genuinely new extraction is intended. Do not label a cached plan as a fresh model call.
- [ ] Whole plan reviewed against the whole clip, including its later action; no invented or omitted critical step.
- [ ] Real phone/laptop camera grant and frame acquisition work. Props remain fully visible, not cropped/occluded.
- [ ] Actual multi-noun check and same-step Recheck succeed; latency and attempted provider calls recorded separately from historical or Gate 0 timings.
- [ ] Missing required prop produces a useful cue; restored prop is recognized by a **fresh** check. Test within real step/session/day/IP budgets.
- [ ] Next, Skip, mute, camera recovery and recap are truthful; mobile instructions and relevant supervision/safety notes remain readable.
- [ ] Failure path works on the final origin and judge access is tested from a fresh browser. Clearly labelled recorded backup is ready.
- [ ] Fresh final unit/build/browser results recorded. Green mocked checks do not establish live quality, all 95 scenarios, real-device acceptance or user benefit.

Record sanitized build/date/device/origin, response status/request IDs, extraction time, capture-to-visible-overlay time and failures. Do not expose credential values or raw private media in the evidence log. Gate 0 reports `sam_still_full_ms`/`sam_clip_full_ms` for complete multi-noun requests; it does not measure the first streamed mask or UI latency. Its default is `unverified_mock`; only an explicit `--live` run can provide credentialed harness evidence.

## Proposed main take

Use the following only after the corresponding live acceptance checks pass. Read actual on-screen step titles; do not invent nouns, outcomes or timings.

### 1. Problem and learner: about 0:00-0:15

Show the safe tabletop setup and the original lesson briefly.

Suggested words: “When you follow a tutorial with your hands busy, finding the next object means looking back and scrubbing. Reel2Real keeps the next step beside your own workspace.”

Frame the browser around 1440px wide for a laptop recording; use a real phone shot when demonstrating phone-stand usability. Hide bookmarks, notifications, credentials and private tabs.

### 2. Owned clip and actual plan: about 0:15-0:45

Choose Use my tutorial clip, upload the permitted lesson, enter its real creator and accurate permission choice, and extract steps. Explain that continuing sends the clip through the server to the configured AI service. Show the real waiting state and measured elapsed time. If editing out a wait is allowed, label that edit and actual elapsed wait; do not present a model call as instant.

Suggested words: “Spark reads this complete clip and creates a step plan. This is our own lesson, and the creator credit stays with it.”

Confirm that the later action is represented. The Live/Mock/Cached label must match the actual returned result. Stop the take if extraction fails; use the labelled backup rather than silently substituting it.

### 3. Camera, correction and fresh recheck: about 0:45-1:35

Allow the camera and show the learner's actual desk. Put two or three relevant objects fully in frame. Point to a returned current-step highlight only when it actually appears. Remove or misframe one required prop in the rehearsed sequence, then use Recheck objects when needed. Show the real missing-object cue, restore the full prop and request another fresh check.

Suggested words: “SAM checks the objects for this step in a camera still. Here the object is missing. I bring it back into view and recheck.”

If the request is paused, unavailable, stale or timed out, leave its real status visible. A previous box is not a fresh detection. Recheck renews only the step allowance; it cannot bypass session/day/rate caps. Do not promise continuous tracking after a match.

### 4. Learner confirmation and recap: about 1:35-2:00

Perform the safe action, then press Next. Finish or deliberately Skip a step so the recap can explain the actual result.

Suggested words: “The highlight tells me the object is visible. I confirm when I have done the step. The recap keeps my confirmations, visible-object evidence, skips and unvisited steps separate.”

Do not say the model verified the fold, pour, technique, temporal order or general safety. “Configured safety cues” are limited rules, not a count of hazards prevented.

### 5. Meta roles and evidence: about 2:00-2:20

Suggested words: “Spark makes the plan. SAM locates the relevant objects. The browser sends requests through our server, so the model key stays server-side.”

Use only fresh measured performance/user observations, with sample size and tested device/mode. If no such evidence exists, omit a numeric claim. Do not quote obsolete first-box benchmarks as current end-to-end performance.

### 6. Optional labelled recorded backup: at most 10-15 seconds

Show one Sample only if it strengthens the explanation within the verified time limit.

Suggested words: “This is a recorded Sample. Its instructions and SAM overlays are saved; it is not the live camera.”

Keep the remaining Samples available for judge exploration. If live acceptance is blocked, present the prototype and recorded sequence honestly with the blocker stated; do not keep the live narration over a replay.

## Recorded Sample inventory and filming notes

Published order: masala-chai, flask-colour, origami, seed-planting, latte-art. The landing hero stays on chai. Open each using its own recorded link; ensure the actual title, media and creator match the selection. Recorded Samples never request the learner camera or spend live highlight calls.

| Demo | Actual sample content / creator | Source and licence |
| --- | --- | --- |
| masala-chai | Kitchen mortar and pestle, visible spices and herbs; Pexels contributor. Do not add cup, ginger or cardamom claims. | [Pexels 5480225](https://www.pexels.com/video/5480225/), [Pexels License](https://www.pexels.com/license/) |
| flask-colour | Flask/bottle and visible colour changes; AlexKopeykin. **Grown-up supervision** remains visible; do not identify chemicals. | [Pixabay 53946](https://pixabay.com/videos/chimie-ballon-chimique-laboratoire-53946/), [Pixabay Content License](https://pixabay.com/service/license-summary/) |
| origami | Patterned paper, a heart, then a crane; Yogendra Singh. | [Pexels 6364305](https://www.pexels.com/video/a-person-making-origami-6364305/), [Pexels License](https://www.pexels.com/license/) |
| seed-planting | Gloves with a tray, a pot, then a jar; Tima Miroshnichenko. | [Pexels 6508485](https://www.pexels.com/video/top-view-of-a-person-planting-seeds-6508485/), [Pexels License](https://www.pexels.com/license/) |
| latte-art | Cup and pouring, including retimed second still; franklandgrave. | [Mixkit 810](https://mixkit.co/free-stock-video/latte-art-810/), [Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree) |

Preserve [CREDITS.md](../public/samples/CREDITS.md). Verify the intended submission use against the actual licence/permission record and existing local policy; this inventory is not a new rights determination.

- Chai: read the actual three current titles. Recorded outlines are mortar/pestle and the supported visible nouns; credit links to the Pexels source.
- Origami: “Fold the patterned paper”, “Press a clean triangle crease”, “Keep folding”. Step 1 names paper only. Step 3 has no verified outline; its hint is “Keep the crane fully in frame.” Do not add one for filming.
- Seed planting: “Poke cells in the seed tray”, “Work down the row”, “Finish with the jar in view”. Supported recorded highlights are gloves/tray, gloves, then jar/gloves.
- Latte: “Start the pour”, “Build a foam circle in the cup”, “Finish the foam”. Step 2 highlights the cup; steps 1 and 3 have no verified outline. Keep the “Keep the cup fully in frame” guidance; do not invent a box.
- Flask: “Pour powder into the flask”, “Watch the colour change”, “Set the flask in view”. Supported recorded highlights are flask/bottle, flask/bottle, then flask. Say only what is visible and keep the supervision note.

A Sample step without a verified outline remains a recorded Sample; absence of an outline is not permission to call it live. The legacy aloo-jeera knife-prop halt is separate from these five Samples. Do not load it accidentally or describe it as a general safety detector.

## Alternative goal-plus-still beat

Use only if deliberately chosen and live-tested instead of the upload story. Enter a safe camera-checkable goal, allow camera, capture one workspace still, plan steps, then use the normal keyframe coach. This uses `/api/instruct`, not tutorial extraction; the plan must not claim source tutorial timestamps. Keep goal, still transmission, actual returned provenance and manual confirmation explicit. A static goal mock is not live personalization evidence.

Instagram preview is optional reference viewing; it is not tutorial import. Do not paste a Reel URL and narrate that it has been extracted. There is no promised browser share-target flow.

**DRAFT. Participant/portal checks, useful physical-task correction, real-phone rehearsal, final filmed evidence and submission remain pending.**
