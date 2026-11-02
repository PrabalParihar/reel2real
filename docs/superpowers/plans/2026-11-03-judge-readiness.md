# Judge readiness implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Track concrete evidence below.

**Goal:** Improve the demonstrable correction loop and submission credibility before the hackathon deadline.

**Architecture:** Reuse the existing SAM presence lifecycle and manual confirmation flow. Separate displayed object evidence from action claims, and preserve source/result provenance.

**Tech Stack:** Next.js 15, React 19, TypeScript, Node 22, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-03-judge-readiness-design.md`

## Global constraints

- Preserve Meta call budgets, source credits, runtime preflight and explicit learner confirmation.
- No dependencies, new model calls, automatic action verification or key changes for UI work.
- Valid absence differs from omitted evidence, request failure and expired evidence.
- Existing recorded examples remain explicitly recorded and camera-free.
- Use branch `codex/hackathon-judge-readiness`; do not change cloud environment configuration.

## Review focus

- A failed request must not imply an object is absent.
- A recheck or step/camera change must clear previous visible evidence.
- Missing required objects must not become skipped-action/order claims.
- Goal-plus-still provenance must survive through recap.
- Mobile upload intent and filmstrip controls must remain reachable.

## Task 1: Current-step object evidence

Files: `src/ui/CoachScreen.tsx`, `src/ui/useCoach.ts` only if necessary, new checklist component/helper/tests, scoped `app/globals.css`, `tests/e2e/object-checklist.spec.ts`.

- [x] Write and run failing tests for required-ID selection, unknown/false/true evidence, failure/staleness and current-step resets.
- [x] Implement compact accessible evidence rows and nearby Recheck; preserve only one button with that label.
- [x] Keep recorded examples recorded; add no camera/model activity for them.
- [x] Fix mobile thumbnail clearance from the fixed action bar and verify jump controls.
- [x] Run targeted unit/browser regressions and report evidence.

## Task 2: Honest feedback and recap

Files: `src/fsm/ui.ts`, `src/voice/lines.ts`, relevant tests, `src/ui/DoneScreen.tsx`, a small recap helper if needed.

- [x] Demonstrate misleading still-frame skip/order and recap-origin labels with failing tests.
- [x] Replace unsupported action/order claims with object-visibility/reframe language.
- [x] Preserve user-initiated Skip outcomes and safety behavior.
- [x] Correct instruction recap provenance and mixed confirmation/visibility count label; run focused tests.

## Task 3: Explicit upload intent and evidence

Files: `src/ui/Landing.tsx`, `src/ui/UploadScreen.tsx`, focused browser test, event/competition/launch/submission/permission documentation.

- [x] Demonstrate mobile clip-intent friction, then open/anchor the existing clip form directly without new routing state.
- [x] Retain plain upload discovery, privacy, permission and capability messaging.
- [x] Publish sourced competition findings and a prioritized owner/engineering/QA task board, without inventing submission counts or winning odds.
- [x] Refresh launch/provider status and draft/rights statements using current evidence.

## Task 4: Review and delivery

- [x] Inspect full diff; independently review material state/lifecycle changes.
- [x] Run unit suite, production build and browser regressions after final code changes.
- [ ] Commit/push a reviewable PR, verify exact-head CI, integrate approved fixes and verify deployed revision.
- [ ] Repeat hosted live probes only after a justified remediation, preserving the approved 200 attempts/process/day cap.

## Evidence ledger

- Research: official rules and exact-track-switch wording refreshed; no public Discord invite or confirmed submission count was found. Direct public concept overlaps are documented separately.
- Hosted baseline: current main deployed, recorded Next/Skip/recap/restart works; fresh instruction 502 and SAM upstream404 remain.
- Ruling: user delegated enhancement choices; use bounded core-loop improvements rather than a new mode. Network diagnosis proceeds separately without changing the key.
- Network outcome: same-region Railway authenticated model catalog is valid and empty (200); unauthenticated control is401. Key accepted; no general Railway egress block. Four diagnostic services removed, original deployments unchanged; no model inference POSTs by diagnostics.
- Review ruling: pending object rows remain Not checked until evidence arrives; existing overall coach state conveys Checking. This avoids adding a second speculative request-state flag.
- Review fix: object visibility can be recorded before Next. The combined recap metric now explicitly says confirmed or visible steps; its SSR regression preserves this distinction.

- Final local verification after review fixes: 69 files / 483 unit tests, production build, and all 36 production-browser regressions passed. Independent review found no remaining material issues. No live provider success, physical-phone result or learner outcome is inferred.
