# Reel2Real hackathon readiness design

User goal: improve the existing project for a Meta hackathon using the completed product/engineering/UX/QA review. The user delegated execution with “You have full access” after the recommended upload-to-coach direction and prioritized defects were presented. This execution uses that recommended direction; it is not a rebrand or a new product. Actual credentials, provider access and official event rules remain external prerequisites, not implied evidence of readiness.

## Scope and constraints

Use existing isolated /workspace/reel2real checkout on branch work. No new worktree, deployment, push, submission, or external team messaging. Node >=22 <23, current Next15/React19/TypeScript/Vitest stack and lockfile remain. Prefer no added dependencies. Keep existing recorded examples, source credits, mock/unit paths and targeted safety refusals.

Fix the confirmed source/runtime defects: stale lesson entry and fallback state; extraction that never settles; nonoptional-cache failure; silent source/credit substitution; inaccurate progression/recap; failed same-step retry and stale overlays; mobile instruction/warning loss; camera acquisition races; unbounded file preparation; capability confusion and incomplete clip analysis. Make runtime configuration explicit and document supported input and model limitations.

## Approaches

A: supported uploaded lesson → faithful plan → learner camera → explicit object recheck → learner-confirmed recap, recommended and selected for implementation by delegated judgment. B: goal/still-only planning reduces ingestion scope but weakens the original lesson proposition. C: curated plan plus live camera needs its own mode; current recorded samples remain a labeled backup (D), not live evidence. Defer new accounts, dashboards, extra demos/models and generalized action verification.

## Contracts

- Public model calls stay off by default. Preserve forwarding precedence. Add an explicit opt-in META_DIRECT_ENABLED=1 mode requiring a configured model key for single-service operation. Never silently make paid calls merely because a key is present.
- Public runtime describes route configuration, not guaranteed upstream health. Add optional capabilities {spark:boolean,instruct:boolean,segment:boolean}; preserve existing model IDs and legacy mock field. Per-result mode/source determines execution provenance.
- Every selected sample supersedes prior uploaded/sample preparation and terminal extraction state, with original sample media/credits. Unknown IDs fail/readably recover. Late results cannot publish into a newer selection.
- Every transport operation is bounded and settles once; malformed JSON rejects; dedupe applies to concurrent identical payloads only. Storage failure cannot block a valid tutorial. Daily cap offers explicit real samples rather than relabeling an unrelated plan with uploader credit.
- Step state distinguishes unvisited, learner-confirmed, object-visible evidence and skipped; jumps alone do not complete steps; unique skip accounting. Manual Next remains available except during the targeted safety halt. Object presence never certifies technique or general safety.
- Same-step recheck resets the per-step request allowance while retaining session/day/rate budgets. Timeout aborts; stale/late results and obsolete boxes cannot masquerade as current detections. Camera/speech stop on leave. Normal users can mute without debug controls.
- Mobile preserves instructions, hints and supervision/safety content. Required selections have programmatic state. Form work is bounded, cancelable and explains supported MP4/WebM limits before reading all bytes. Missing camera offers a working recorded fallback.
- Short supported clips must not silently discard all actions after second two. Use the existing video/files request pathways with complete supported input or explicitly report a supported limit. Gate0 must send the actual clip and required attribution and distinguish mock from live evidence.

## Evidence and completion

Add focused failing regressions before behavioral fixes, execute them red then green, run the full existing suite and production build/type validation, then exercise the actual browser paths that failed. Preserve fresh recorded sample flows and recorded labels. Save a closure ledger mapping completed fixes to tests and explicit external blockers. Do not mark all audit tasks complete when credentialed/live/device/user-research scenarios remain unrun.
