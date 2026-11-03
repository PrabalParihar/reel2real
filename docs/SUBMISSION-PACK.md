# Reel2Real — submission copy

Prepared November 4 IST. Participant screenshots confirm team/track/problem-statement fields and required Project Description, Public GitHub Repository, 3-Minute Demo Video, Meta product usage and why the models matter. The form also has optional partner feedback and a required future-use likelihood question. Character limits and video-host validation remain unverified. This pack is ready to use; it is not a submission confirmation.

## Fill the actual form without field-by-field copying

[Open the autofill helper](https://web-production-d1454.up.railway.app/submission/autofill.html), drag its Fill Reel2Real link to Chrome's bookmarks bar, then click that saved bookmark while your existing signed-in submission form is active. The self-contained bookmarklet fills the six known blank text fields using native setters/events compatible with controlled React inputs. It preserves nonempty entries, team/track selections, ratings and declarations; it does not click Submit. Missing, ambiguous, read-only and invalid fields are reported. It does not read cookies, credentials or storage or transmit form contents to our server; site listeners can react normally to input events. Actual private-page execution is unverified until the user invokes it.

The demo is a real 123-second MP4. The form's YouTube placeholder alone does not prove a host restriction. If the portal rejects that link, upload the prepared video to an accepted host and use its real URL. Do not invent a YouTube link.

## Submission links and observed form values

| Field | Value |
| --- | --- |
| Team name (existing screenshot value) | witlabs |
| Team member (shown in participant form) | Prabal Singh / 0xPrabal |
| Project | Reel2Real |
| Track | Indie Developer Track |
| Problem statement | Build for Your World |
| Most Viral X post | Leave blank unless entering with an actual project post. |
| Live app | https://web-production-d1454.up.railway.app |
| Demo player | https://web-production-d1454.up.railway.app/submission/index.html |
| Direct MP4 | https://web-production-d1454.up.railway.app/submission/reel2real-demo.mp4 |
| GitHub | https://github.com/PrabalParihar/reel2real |

The track and problem statement were visibly selected in the user's form, but saving/submission requires the portal's actual confirmation. Later screenshots show the required description/repository/video/Meta-answer fields; the repository field is populated. Partner feedback is optional; the future-use likelihood field already shows the user's Very likely selection. Do not invent a completed submission, extra team members, an X post, a Hugging Face repository, personal eligibility, rights declarations or waiver assent. No authenticated participant session or Chrome-control tool is connected to this workspace.

The demo is 2:03, an editorial duration rather than a verified event limit. It records the hosted app with synthetic narration, labelled recorded Sample playback, owned generated QA media and a virtual camera. Model responses are real and are not intercepted. The uploaded-clip and goal-plus-still results come from separate labelled runs. A planning wait is shortened and labelled. No physical learner footage or measured learning benefit is claimed. See [media provenance](../public/submission/README.md).

## Project name

Reel2Real

## Tagline

From tutorial to tabletop, one step at a time.

## Short description — proposed field version

Reel2Real turns a short tutorial into a step guide beside your own workspace. Muse Spark creates the plan from a permitted video, or a goal and workspace still. SAM 3.1 checks camera keyframes for the objects needed next. Learners recheck, confirm steps and review a recap that separates their confirmations from object visibility. Five clearly labelled recorded Samples make the interaction easy to explore.

## Medium description — proposed field version

Following a hands-on tutorial often means pausing, scrubbing and looking between the lesson and your workspace. Reel2Real explores a more focused way to follow short, safe tabletop lessons with a phone on a stand or a laptop camera.

Upload a tutorial you own or have permission to use. Muse Spark reads the complete accepted clip and creates a structured step plan. Alternatively, start with a goal and one workspace still. In the coach, SAM 3.1 looks for the current step’s objects in camera keyframes, with visible results and an explicit Recheck control. The learner presses Next to confirm a step; the recap distinguishes those confirmations from object visibility, skipped steps and unvisited steps.

The prototype combines Meta planning and localization in a browser app with clear Live, Cached and recorded Sample labels, bounded requests and manual recovery. Five recorded Samples let visitors explore without a camera or model call. Live planning and controlled object localization have been demonstrated; useful physical-task correction and real-phone validation remain open. Object visibility does not verify an action, technique or safety. Learning benefits have not yet been measured.

## Full description — proposed field version

Reel2Real is a browser guide for the moment when watching a tutorial becomes doing the task. A beginner following a hands-on lesson may have to pause, scrub back and work out which object the next instruction refers to while their hands are already occupied. Our initial focus is short, safe tabletop lessons with a few visually distinct props, using a phone on a stand or a laptop camera.

The app offers two ways to begin. Upload a playable MP4 or WebM tutorial that you own or have permission to use, up to 16 MiB and two minutes, and Muse Spark creates a structured plan from the complete accepted clip. Or enter a goal, capture one workspace still and ask Spark for a short plan based on that starting point. Creator details stay with uploaded lessons, and plans made from a still are labelled accordingly.

The coach connects each step to the learner’s workspace. It captures JPEG keyframes and asks SAM 3.1 to locate the objects needed for the current instruction. The learner can adjust the framing and request a fresh check, follow the instruction, then press Next to confirm their own progress. The recap keeps learner confirmations, object visibility, skips and unvisited steps separate. A visible object is evidence about the frame; it does not establish that a fold, pour or other action was performed correctly, in the right order or safely.

Meta’s models have distinct product roles: Muse Spark supplies the plan, and SAM 3.1 supplies object localization. Next.js, React and TypeScript connect them through server-side API routes and a protected model worker, keeping model credentials out of the browser. Input validation, bounded requests, cancellation and request budgets support predictable recovery. Plans can be cached locally, and failed checks remain visibly unavailable rather than becoming invented success. Five recorded Samples offer an accessible way to explore saved lessons and SAM overlays without a camera or live model calls; their recorded provenance and source credits stay visible.

Tutorial-to-camera coaching has direct public comparables. Reel2Real’s current emphasis is the interaction between the current step, visible object evidence and explicit learner confirmation, with clear boundaries around what the system actually knows. The deployed prototype has demonstrated live goal planning, complete-clip planning through both inline video and the Files API, and controlled SAM localization. Object recall remains a material limitation: three checks of a restored blue object missed it in a procedural fixture. A successful end-to-end physical lesson, real-phone validation and learner evaluation remain to be completed.

The intended benefit is less friction between watching and doing. Our next evaluation is a paired comparison against ordinary tutorial playback and a checklist, including setup time, waiting, interruptions and task outcomes. We are presenting a working prototype and a testable learning hypothesis; we do not yet claim measured learning gains.

## Problem and intended users — proposed field version

Beginners following hands-on tutorials must repeatedly map a video’s instructions onto the objects in front of them. That can be awkward when their hands are busy and the lesson moves faster than they do. Reel2Real starts with people following short, safe tabletop lessons with a few visually distinct props. It aims to keep the next instruction and relevant object evidence beside their workspace. Whether this improves the experience over playback and a checklist still needs learner testing.

## How we use Meta AI — proposed field version

Muse Spark (`muse-spark-1.3`) produces a structured step plan from either a complete accepted tutorial clip or a goal plus one workspace still. Shorter clips use inline video; longer or larger accepted clips use Meta’s Files API. SAM 3.1 (`sam-3.1`) localizes the objects required by the current step in JPEG camera keyframes. The app combines planning and localization while leaving step completion to the learner’s explicit confirmation. Model requests pass through the server; the browser never receives the model key. Muse Image is not used.

## Technology and architecture — proposed field version

The app uses Next.js, React, TypeScript and Node 22, deployed on Railway. The browser handles tutorial preparation, camera keyframes and the lesson interface. Same-origin API routes validate media and model contracts, then forward live model work to an authenticated worker. Structured plans and provenance connect the planner to the step coach. Request deadlines, cancellation, per-step and per-session allowances, throttling and daily budgets bound model use. Optional IndexedDB caching preserves eligible plans locally, while recorded Samples remain a separate, labelled exploration path.

## What is distinctive — proposed field version

Reel2Real brings complete-clip planning, step-specific object localization and learner-confirmed progress into one lesson flow. Its focus is evidence people can interpret: what the camera found, what the learner confirmed, what was skipped and what remains unchecked. Live, Cached and recorded Sample results stay distinct, and retry or manual recovery stays available when checks fail. Related tutorial-to-camera projects exist; our differentiation rests on the execution and clarity of this interaction rather than a claim to have invented the category.

## Current limitations and next steps — proposed field version

Object detection is imperfect. In a controlled procedural fixture, three restored-blue checks missed the object across PNG and JPEG inputs; the cause has not been isolated between provider output and the adapter. A successful red-object check does not resolve those misses. We still need a complete useful physical-task correction loop, real-phone camera validation and learner evaluation. Coaching uses keyframes rather than continuous tracking. Next records the learner’s confirmation; the app does not autonomously verify actions, technique, order or general safety. Recorded Samples are saved demonstrations. No learning-outcome or time-saving claim has been established.

## Intended impact / what comes next — proposed field version

The goal is to make hands-on learning easier to follow when attention is split between the lesson and the workspace. The next milestone is a dependable physical lesson with a useful fresh object recheck, followed by a small paired learner comparison against tutorial playback and a checklist. We will measure setup, waiting, interruptions and task outcomes before claiming a benefit or expanding to more domains.

## Media and data handling — proposed field version

Users should upload footage they own or are permitted to use. Continuing sends the complete accepted clip and supplied details through the app server to the configured model service; live checks send workspace frames. File-based planning uses Meta’s Files API. Eligible plans can be stored in the browser for up to seven days, with a clear control. We do not claim provider retention or deletion guarantees. Recorded Samples keep their creator, source and licence credits.

## Project links

- Live app: https://web-production-d1454.up.railway.app
- Source: https://github.com/PrabalParihar/reel2real

## Fresh verification and remaining boundaries

On November 3 UTC / November 4 IST, Node 22 verification passed: **505 unit tests across 70 files**, production compile/type checks and static generation. Fresh no-interception Chromium checks passed **16 functional scenarios** covering all five recorded lessons, Next/Skip and recap, replay, same-tab lesson selection, jump-ahead outcomes, four responsive widths, upload gating, mobile supervision and cold recovery. These checks do not establish real-phone camera behavior or learner benefit.

Three independent public model probes passed: goal planning (22.247 s), six-second complete-clip planning (7.831 s, later blue action included), and red-square localization (1.563 s). These are individual test observations, not latency guarantees or performance percentiles.

The screen recording separately captured live complete-clip planning and eight SAM requests across two runs. Five clip-run checks returned no object boxes for visible cards/tray. Three goal-run checks each localized red paper but did not highlight paper edge/corner. Earlier restored-blue misses across PNG/JPEG remain unresolved. The cause has not been isolated between provider behavior and the adapter. A useful physical-task missing-to-restored correction loop, real phones and learner outcomes remain unverified.

The separate goal-plus-still run contains a real red-paper box and fresh recheck. This positive result does not resolve the missed detections. Next and the recap remain learner confirmations; no action, technique, order or general-safety verification is claimed.

## Final portal handoff

1. Use the existing accepted Cerebral Valley account and the values above; do not create a duplicate application.
2. Confirm the actual form's remaining fields and participant-only instructions. Paste the project description and links where those fields exist. If a specific video host or shorter duration is required, adapt the prepared 123-second source rather than inventing a link.
3. Complete personal eligibility, team authority and waiver statements accurately as the participant. The copy makes no such declarations.
4. Submit by **November 5, 2026 at 07:30 IST** (November 4, 21:00 EST). Source: [official event](https://cerebralvalley.ai/e/meta-ai-developer-hackathon).
5. Preserve the confirmation URL or submission ID. Until that receipt exists, the submission remains **unconfirmed**.
