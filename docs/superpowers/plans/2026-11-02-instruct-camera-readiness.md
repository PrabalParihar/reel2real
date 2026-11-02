# Instruction camera readiness implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Track evidence below; preserve prior work.

**Goal:** Replace PR #17 with a focused, verified camera readiness improvement.

**Architecture:** Keep current acquisition and planning controllers. Add a disposable frame-readiness observer and integrate it into the instruction preview; retain the current session and extraction implementation.

**Tech Stack:** Next.js 15, React 19, TypeScript, Node 22, Vitest and Playwright.

**Spec:** `docs/superpowers/specs/2026-11-02-instruct-camera-readiness-design.md`

## Global constraints

- No dependencies or live model calls.
- Preserve 20-second camera acquisition and 45-second cancellable planning.
- Eight-second first-frame deadline begins after stream attachment.
- Capability preflight, response validation and provenance remain enforced.
- Use the managed checkout on a fresh feature branch; do not rewrite PR #17's branch or commits.

## Review focus

- Already-ready capture never leaves a stale timeout.
- Autoplay rejection still permits later frames and bounded recovery.
- Cancelled permission resolves stop their tracks without reviving the screen.
- Runtime capability loss stops preview and cancels planning.
- Retry creates one acquisition and one fresh preview deadline.

## Task 1: Busy camera acquisition

Files: `src/coach/camera.ts`, `src/coach/camera.test.ts`.

- [x] Add and run failing tests: NotReadableError and legacy TrackStartError are returned after one request.
- [x] Preserve fallback for missing rear-camera constraints and abort checks.
- [x] Implement the busy error exclusion; run the focused suite.

## Task 2: Preview lifecycle

Files: `src/ui/InstructScreen.tsx`, a focused preview helper and its Vitest tests, scoped styles if needed.

- [x] Write and run failing tests for frame readiness, playback rejection, first-frame timeout, cleanup and already-ready disposal.
- [x] Implement a disposable observer and integrate a stable video ref mounted during opening.
- [x] Add readiness-gated Capture, actionable startup recovery and busy error copy.
- [x] Retain existing acquisition, capability and planning protections.
- [x] Run focused tests and TypeScript verification.

## Task 3: Browser integration and review

Files: `tests/e2e/instruct-camera.spec.ts` and this evidence ledger.

- [x] Demonstrate current behavior fails representative browser regressions before implementation.
- [x] Verify delayed frames, timeout/retry, successful capture beyond eight seconds, permission/busy errors, unmount and instruction-to-coach with mocked APIs.
- [x] Run all unit tests, production build and browser regressions.
- [x] Independently review the complete patch and resolve material findings.
- [ ] Commit/push a focused replacement PR; verify exact-head CI.
- [ ] Integrate the verified replacement and close superseded PR #17 without deleting its branch.

## Evidence ledger

- Baseline: main `fa5ab22` includes PR #18; PR #17 head is `189a7d5` and conflicts with main.
- Ruling: user delegated implementation and integration decisions; proceed without further design questions.
- Ruling: preserve the existing managed checkout and use `codex/instruct-camera-readiness` for this change.
- Task 1: modern busy regression failed before the guard, then passed; legacy busy regression also failed before its guard, then all seven camera tests passed. Missing-rear-camera fallback and abort coverage remain green.
- Task 2: preview and busy-copy tests demonstrated red-to-green behavior; focused lifecycle suite passed 18 tests. Full local unit run passed 457 tests before the added legacy-busy case; the added case subsequently passed in the seven-test camera suite. TypeScript and production build passed.
- Task 3: baseline browser tests demonstrated missing preview during permission and premature Capture enabling. All 31 browser tests then passed, including eight new camera cases and a mobile capture-to-coach journey with malformed-response recovery. Review strengthened the browser clock placement before attachment; that updated case passed separately.
- Independent review: spec and quality approved with both minor findings resolved (legacy busy guard and browser clock ownership). No outstanding findings. Exact-head hosted CI and integration are the remaining steps.
- Final local unit verification after both review fixes: 67 files, 458 tests passed. The mobile browser capture case also passed with its clock installed before attachment.
- Limits: synthetic camera and mocked APIs verify the frontend lifecycle, not physical-phone behavior or hosted Meta entitlement. Existing hosted Meta credential issue is unchanged.
