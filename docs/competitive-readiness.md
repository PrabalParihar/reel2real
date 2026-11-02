# Meta hackathon: competition and delivery priorities

Research refreshed **November 3, 2026, Asia/Calcutta**. Sources are public pages;
private submissions, acceptance records and participant Discord were not accessed.
This is an assessment and working plan, not an organizer ranking or win prediction.

## Event facts

- Deadline: **November 5, 07:30 IST**, from November 4, 9 PM ET.
- Rubric: impact **30%**, Meta tooling **25%**, technical execution **20%**, demo **25%**.
- Indie prizes listed: $150k, $100k, $75k, $50k and $25k. Startup prizes differ.
- The user prefers **Indie Developer** after applying to Startup. The official
  public application question explicitly says **“you can change your track anytime.”**
  Change the existing application; the event warns against duplicate applications.
  Actual saved track, acceptance and the authenticated edit path remain unverified.
- **20,000 is a maximum accepted-applicant count, not submitted builds.** The public
  gallery and voting are disabled; no reliable submitted-project total was exposed.
- No public Discord invite appeared in the four official event/application/rules/
  submission documents or seven retrieved official social pages. The event mentions
  Discord office hours. An invite may be in acceptance email or participant view;
  that is a next place to check, not an observed link.

The user then provided the welcome email's direct participant routes:
[details](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details) and
[Discord](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/discord). They require
the original signed-in approved account; the Discord route then links the user's
Discord account before showing an invite. The private content was not read and no
account was linked or joined. These are the concrete next places to obtain model
activation instructions, problem statements and current participant announcements.
The user also supplied a screenshot of Discord server `1557169028080869426`.
Its welcome instructions and lock icons do not establish the user's current role
or access; private channel messages remain unread.

Sources: [event](https://cerebralvalley.ai/e/meta-ai-developer-hackathon),
[rules](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver),
[application](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/apply),
[submission portal](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit).
The public submission URL returned the event shell; private artifact fields and
video-length limits are still unknown. See [event requirements](event-requirements.md).

## Public activity and comparable builds

These repositories publicly identify with this event or its dates. Descriptions and
benchmarks below are **authors' claims**, not independently tested functionality or
organizer-confirmed submissions. README links are pinned to the reviewed revisions.

| Build | Published overlap | Evidence boundary |
| --- | --- | --- |
| [FollowAlong](https://github.com/unnatibshah/followalong/blob/57931f6c62404d9f431cfbc546161c38b93aa9ae/README.md) | Tutorial → ordered steps → webcam feedback and reference replay; Spark, SAM and voice. | Closest direct overlap; public demo and self-reported 211-frame benchmark, not reproduced here. |
| [Apprentice](https://github.com/bubblesdev/apprentice/blob/250f0e9f47aa36036fb13da0b2b2617e9a53b747/README.md) | Expert video → grounded steps → trainee phone coaching. | Direct concept overlap; README lists app/API/worker as next work. |
| [Show Me the Problem](https://github.com/gws-builds/show-me-the-problem/blob/6e4cac3b255722b3f163498e55d3ffadd8445e98/README.md) | Home-repair camera call, part outlines, voice and grounded evidence. | Adjacent physical-assistance use case with a specific business workflow. |
| [FieldKit](https://github.com/NullAITech/nullai-fieldkit/blob/6edc975e7f52ed1d0ca1b3fd03af39ec72e0a200/README.md) | Glasses/phone mission coaching with planning and observation. | Developer preview; lists remaining integration and demo work. |
| [Origin](https://github.com/jenzylove/origin/blob/02fe01c50d18cc8bc158686f2809262f22d14b6a/README.md) | Video instructions → grounded steps → execute/repair software workflows. | Public runs and admitted misses; a different execution domain. |
| [Crew Sync](https://github.com/zenith4eva/crew-sync/blob/7a6a1efdb7030e79ab264c5934fb158a6e57e11a/README.md) | Dance-video/reference comparison → SAM measurements → coaching. | Narrow measurable domain; evaluation claims were not reproduced. |

Recent public development includes November 2 updates to several of these builds.
In [Cerebral Valley's event-post comments](https://www.linkedin.com/posts/cerebralvalley_hosting-a-1m-prize-pool-hackathon-with-meta-activity-7515822913267200000-OFdQ),
Alex Sorokin described an Indie Airbnb-cleaning checker using Spark/SAM on October
31, and Ryan Cotten described a trailer-load photo checker on October 28. These are
public participation claims, not a submission census. [Meta's event reminder](https://www.linkedin.com/posts/meta-for-developers_clear-your-calendar-warm-up-your-terminal-activity-7519086584147910657-q4xe)
also advertised the event and credits.

General camera assistance already exists in [Google Lens](https://lens.google/) and
[Gemini Live](https://support.google.com/gemini/answer/15274899?hl=en). They are product
comparables, not hackathon entrants. “Tutorial to camera coach” alone is not a
defensible uniqueness claim given the direct public overlaps above.

Research limits: public GitHub sources and some X/LinkedIn guest pages were readable;
search engines returned limited results or challenges, and no private channels were
accessed. Repository-search hit counts overlap and do not measure entrants. Raw
retrieval evidence is outside the source tree under
`/workspace/reel2real-review/hackathon-nov3/{official,competition}`.

## What can make Reel2Real competitive

Show one specific useful interaction: a beginner's owned safe lesson → faithful
plan → the beginner's actual objects → a useful missing-object cue → a fresh
recheck → explicit learner confirmation. Measure whether it helps against the
same tutorial plus a checklist, including setup and waiting time. Do not imply the
model verified an action, temporal order or safety from object presence.

| Criterion | Evidence available | Evidence still needed |
| --- | --- | --- |
| Impact, 30% | A concrete hands-busy learning hypothesis. | Observed beginner outcomes and setup/interruptions comparison. |
| Meta tooling, 25% | Verified live public-origin Spark planning and decoded SAM localization through the protected worker. | Resolve restored-blue false negatives; useful fresh recheck on an owned physical task. |
| Technical execution, 20% | Bounded/cancellable flows, truthful outcomes, passing build/regressions and hosted recorded-flow checks. | Resolve restored-blue false negatives; physical-task quality and target-phone rehearsal. |
| Demo, 25% | Working labelled recorded exploration and recovery paths. | Filmed real task, current judge-origin rehearsal and verified portal limits. |

[PR #20](https://github.com/PrabalParihar/reel2real/pull/20) merged as
`756d34f`. CI passed; local verification passed **483 unit tests**, **36 production
browser checks**, type checking and the production build. Five focused mobile UI
checks then passed on the deployed origin: clip entry, supervision text, thumbnail
clearance, honest recap and recorded restart. Those checks used recorded/synthetic
data and made **zero live AI requests**; they do not establish camera, real-model
or learner acceptance.

Current public deployment `d3ee4b77` (frontend `756d34f`) privately forwards all
three model routes to manually pinned worker `258e0cb5`, source `234f32a`.
Public live acceptance passed: goal plan **22.790 s**, six-second generated clip
**7.422 s** with later blue step at 3.2–6 s, and SAM **1.291 s** with a decoded
red-fixture box (IoU **0.989714**, not general accuracy). A **12-second Files API
clip** also passed in **9.97 s**, with later blue content at 6–11.5 s and independent
schema validation. Review, **505 unit tests/70 files**, **36 production browser
tests**, build and both CI checks passed for `234f32a`.

The upload fix supplies app-owned identity/provenance and actual duration/MIME,
prompts exact enums, and preserves model roles/source times under strict validation.
The final revision also requests documented Spark low reasoning effort. No deadline,
model, token-cap or retry change, fixed omitted-effort default or p95 improvement
is claimed. Earlier model404s and recovery after equal-value key-assignment control
do not establish a source-policy cause; no key rotation occurred. See [launch
operations and evidence](railway-launch.md).

**Useful correction remains a model-quality P0:** five controlled SAM calls returned HTTP/upstream200 and `ok:true`; all three
restored-frame checks missed blue, while both absent-frame checks were correct.
The misses span generic/planner PNG and planner JPEG. Raw output was not retained, so upstream
versus adapter cause is unknown. Inspect controlled raw output, benchmark recall
on frozen real props and verify a useful fresh correction on a physical phone.
The positive red-box result does not close this failure. Generated QA clips do
not establish an owned real demo or learner benefit.

No numerical winning probability is supported: the actual field, organizer ranking
and complete live/user evidence are unknown. The protected-worker result establishes
working public model integration; a useful real learner loop and measured benefit
remain necessary before calling the demonstration winning-ready.
Additional unrelated modes would not fill those evidence gaps.

## Product manager / engineer / QA task board

| Priority / owner | Deliverable | Acceptance / status |
| --- | --- | --- |
| Done — backend + QA | Recover real public instruction planning and localization through protected forwarding. | Current public `d3ee4b77` passes typed/semantic checks; Spark plan valid and SAM box decoded/present. Physical-task fresh recheck remains in the demo/phone tasks. [Support draft](meta-access-support-draft.md). |
| Done — backend + QA | Repair live clip-plan contract and prove later-content/Files handling. | Source `234f32a` reviewed, 505 unit/36 browser/build/CI pass; public six-second inline and 12-second Files clips valid with later content. Generated QA proof, not physical-demo acceptance. |
| P0 — engineering + QA | Diagnose restored-object false negatives and verify useful correction. | Five calls: all three restored-frame checks missed blue; both absent-frame checks correct, despite upstream200/ok:true. Inspect raw controlled output/adapter versus upstream; frozen real-prop recall benchmark and physical-phone missing→restore→fresh-Recheck proof required. [Canonical evidence](railway-launch.md). |
| P0 — team representative | Switch existing Startup application to Indie and verify acceptance/waiver. | Saved track and accepted status visible in participant account; no duplicate application. |
| P0 — team + QA | Film and test one owned safe tabletop lesson. | Later clip action represented; absent/restored object yields useful fresh responses; no replay substituted. |
| P0 — team representative | Inspect authenticated portal and participant communications. | Actual video limit, fields and required links recorded; participant announcements and saved Discord role/access checked. Private content remains unverified. |
| P0 — research lead + learners | Small paired learner comparison. | Real observations from 3–5 learners, including failures/setup, in [trial worksheet](learner-evaluation.md). No fabricated testimonials or percentages. |
| P0 — QA | Target-phone and fresh-browser rehearsal. | Real permissions, first frame, missing-object correction, recheck, voice/mute, Next/Skip and recap verified. |
| P0 — team representative | Final video, copy and submission. | Only demonstrated claims, accurate rights/source credit, actual portal limits; save submission receipt. Drafts remain unsubmitted. |
| P1 — frontend + QA | Current-step object checklist. | Implemented, merged and deployed; CI/local regression and recorded-flow checks passed. Unknown, absent, visible, unavailable and stale stay distinct; real-model acceptance remains open. |
| P1 — frontend + QA | Honest voice/status/recap labels. | Implemented, merged and deployed; relevant regressions and hosted recap check passed. No detector-derived skipped-action/order claim; still origin and mixed confirmation/visibility count retained. |
| P1 — frontend + QA | Mobile clip intent and thumbnail access. | Implemented, merged and deployed; hosted entry and clearance checks passed. Explicit clip entry reaches the form and thumbnails remain reachable above the dock; target-phone rehearsal remains open. |
| P1 — backend + QA | Measure planning latency and timeout margin. | Planning took 20.9 and 39.6 seconds in two runs. Measure representative-task p50/p95, timeout and cancellation rates; verify useful waiting/failure states against the 45-second model deadline. No performance improvement is claimed. |
| P2 — team | New domains/models/automatic action detection. | Deferred until the core evidence is strong; not needed to show this loop. |

Recommended internal freeze: **November 4, 22:00 IST**, leaving time before the
official November 5, 07:30 IST deadline. This is a team recommendation, not an
organizer deadline. Final acceptance takes priority over more feature work.
