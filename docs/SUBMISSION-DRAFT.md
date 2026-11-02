# DRAFT. Do not submit.

This is editable submission copy for Reel2Real. **This submission draft has not been submitted or published.** The [official sources were refreshed November 3, 2026, Asia/Calcutta](event-requirements.md); submissions are due **November 5 at 07:30 IST**. The user prefers Indie Developer after applying to Startup; the official application permits switching, but the saved track and acceptance remain unverified. Portal fields/length limits, rights/prior-work questions, owned physical-lesson/full-journey acceptance, physical-device testing and learner observations remain pending. Public goal, generated-clip inline/Files and red-box SAM checks pass; restored-blue false negatives leave useful correction unverified; see the current evidence below. See the [competition assessment and task board](competitive-readiness.md). Source implementation and mocked/browser tests are not substitutes for live results.

## Name

Reel2Real

## One-liner

Turn a tutorial into a step guide that highlights the objects for your next move in your own camera view.

## Problem and initial audience

A beginner following a hands-on lesson has to look back at the video, pause, scrub and work out which object the next step refers to. Their hands may already be occupied. We are starting with short, safe tabletop lessons with a few visually distinct props, using a phone on a stand or a laptop camera.

This is a product hypothesis, not a validated learning-outcome claim. We still need to compare setup cost, interruptions and task outcomes against ordinary tutorial playback and checklists with target learners.

## What the current implementation does

Upload a playable MP4/WebM lesson you own or are permitted to use, at most 16 MiB and 120 seconds. Supply accurate creator/permission details. The app sends the complete supported clip through its server for Muse Spark to produce a schema-validated step plan. Short/small accepted clips use inline video; longer/larger clips use the Files API. The clip is not silently reduced to its first two seconds.

The coach captures workspace keyframes and asks SAM 3.1 to locate the current step's objects. The learner can reframe and explicitly Recheck objects. Next records the learner's confirmation; Skip remains a deliberate choice. The recap distinguishes learner confirmation, object visibility, skipped and unvisited steps. An object highlight does **not** establish correct technique, the completion or temporal order of an action, or general safety. The current browser camera path uses JPEG keyframes, not continuous video tracking.

Instruction mode offers a second path: state a safe goal, capture one workspace still, request a short plan, and enter the keyframe coach. A still-derived plan is labelled accordingly and does not imply tutorial timestamps. Public-origin planning returned a valid live three-step plan; useful physical-task quality and the complete learner journey still need acceptance.

When live configuration is unavailable, the app says so before lengthy upload/camera work. Failed/expired checks do not invent successful boxes. Users can retry/recheck or move through the lesson manually, except during a specific configured safety halt. Cache persistence is optional; a storage failure does not block a valid plan. Daily-cap recovery uses matching cached output or offers an explicit recorded Sample with that Sample's own media and credit.

## Why the Meta models matter

| Model | ID | Product role |
| --- | --- | --- |
| Muse Spark | `muse-spark-1.3` | Turn complete supported tutorial media, or a goal plus still, into a structured plan. |
| SAM 3.1 | `sam-3.1` | Localize the objects needed for the current step in the learner's workspace frame. |

The intended distinctive interaction is lesson → current step → learner's actual objects → specific reframing cue → fresh recheck. The planner provides the sequence; localization ties that sequence to the learner's workspace. Public-origin live planning and synthetic-fixture localization now have narrow proof; the complete uploaded-lesson and physical-task interaction remains unverified.

Live requests use the app server and default `POST https://api.meta.ai/v1/responses`. The browser never holds the model key. Muse Image is not used. Public model routes default off: one-service direct mode requires explicit `META_DIRECT_ENABLED=1` and a usable server credential; valid enabled forwarding takes precedence per route. `/api/runtime` reports configured capability, not upstream health. User-visible Live/Mock/Sample/Cached labels follow returned result provenance rather than the presence of a key.

SAM can make one provider call per noun, up to four, under one total eight-second request deadline. Spark has a bounded complete operation across inline/file/fallback/response. These are safeguards, not latency guarantees. Historical first-box benchmarks are not current multi-noun UI performance, and Gate 0 explicitly does not measure first streamed mask time.

## Recorded Samples and attribution

Five Samples ship with saved instructions, media and recorded SAM output so people can explore the interaction without a model key or camera. These requests stay local even when live configuration is enabled. They are labelled Sample/recorded SAM output; a Sample replay is not a live model demonstration.

| Sample | Creator/source |
| --- | --- |
| Masala chai | Pexels contributor, [Pexels 5480225](https://www.pexels.com/video/5480225/) |
| Kids science flask | AlexKopeykin, [Pixabay 53946](https://pixabay.com/videos/chimie-ballon-chimique-laboratoire-53946/) |
| Origami | Yogendra Singh, [Pexels 6364305](https://www.pexels.com/video/a-person-making-origami-6364305/) |
| Seed planting | Tima Miroshnichenko, [Pexels 6508485](https://www.pexels.com/video/top-view-of-a-person-planting-seeds-6508485/) |
| Latte art | franklandgrave, [Mixkit 810](https://mixkit.co/free-stock-video/latte-art-810/) |

The hero stays on chai. Every recorded demo retains its source/licence credit; these stock assets are not described as self-filmed. Licence links are in [CREDITS.md](../public/samples/CREDITS.md). Verify intended submission use and reconcile the existing local permission policy before including footage in a final video. The flask Sample retains **Grown-up supervision**, describes only visible content and does not name chemicals. Some Sample steps have no verified outline and remain honestly unhighlighted.

Instagram preview is optional reference viewing, not automatic extraction/import or a share-target integration. Users still need a permitted local tutorial file for the upload route.

## Technology and media handling

Next.js, React, TypeScript and Node 22. Same-origin API routes keep credentials server-side. Plan schemas, bounded input preparation, media/MIME validation, cancellation, per-step request allowances, per-session limits, per-IP throttling and per-process daily budgets constrain work. Recheck resets only the step allowance. Normal mute/camera recovery and mobile instruction/supervision content are available.

Browser preparation inspects/hashes locally; continuing sends the complete clip and supplied details to the configured model service through the server. Camera checks send workspace frames. File-based planning uploads to Meta's Files API. Validated plans, metadata and original execution provenance may be cached locally with seven-day eligibility and a clear control. We do not claim provider retention or deletion guarantees from this repository.

Deployment configuration is provided for a Node web service and optional authenticated worker forwarding. This draft does not establish that a particular deployment is current or live-ready.

## Evidence to insert before submission

- **Participant and portal requirements:** use the [verified sources, deadline and rubric](event-requirements.md); confirm personal eligibility, accepted-participant/waiver status and track, and resolve portal artifacts, length limits and prior-work uncertainty. Do not infer blanket prior-work permission from silence in the retrieved rules.
- **Hosted build and access:** public `d3ee4b77` forwards to manually pinned worker `258e0cb5`/source `234f32a`. Goal22.790 s, six-second generated clip7.422 s, red-box SAM1.291 s and 12-second Files clip9.97 s pass, including later clip content. Review, 505 unit tests/70 files, 36 production browser tests, build and CI pass. Five SAM calls: all three restored-frame checks missed blue; both absent-frame checks correct, with upstream200; upstream-versus-adapter cause is unknown. Useful correction, judge rehearsal and the complete physical demo remain pending. See [launch evidence and manual worker/key limits](railway-launch.md).
- **Real model demonstration:** owned/permitted clip, full plan fidelity including a later action, relevant object localization, missing-object recovery and fresh same-step Recheck. No intercepted response or replay can fill this slot.
- **Measured performance:** extraction time and capture-to-visible-overlay time, device/network, noun count, sample size, p50/p95 when meaningful, failures/fallbacks and actual per-noun/file/retry call attempts. Do not reuse obsolete first-mask numbers.
- **Software verification:** fresh post-review unit/build/browser commands and results, with the actually executed scenario subset. Do not say all 95 audit scenarios passed.
- **Device/accessibility/user evidence:** real Safari/Android camera behavior, permissions/interruption, mobile warnings, keyboard/screenreader/zoom testing, and observed target-user outcomes. Mark any remaining unrun boundary plainly.

These evidence items are currently pending where external prerequisites or unexecuted acceptance remain. See [hackathon-readiness.md](hackathon-readiness.md) for exact audit closure and [demo-script.md](demo-script.md) for a proposed, not yet verified filming sequence. No win probability is supported by the current evidence.

## Next after the core loop is validated

Measure whether target learners get useful corrections and finish with fewer interruptions, including setup time. Then evaluate creator/teacher lesson review and distribution. Expand domains, richer action checks, voice navigation, sharing or other features only when that evidence justifies the added scope.

**DRAFT. Not submitted. Resolve participant/portal requirements, rights, real hosted behavior and evidence before external use.**
