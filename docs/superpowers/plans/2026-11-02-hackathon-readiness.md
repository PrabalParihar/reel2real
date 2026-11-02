# Hackathon Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Repair the audited core user journeys and make configured live operation explicit and testable.

**Architecture:** Preserve the existing Next app, same-origin routes, server model clients, React session and coach state machine. Implement independent modules with file ownership, then integrate types, review and verify actual browser regressions.

**Tech Stack:** Node22, Next15, React19, TypeScript, Vitest; installed Playwright/Chromium for external browser validation.

**Spec:** ../specs/2026-11-02-hackathon-readiness-design.md

## Global Constraints

- Existing isolated checkout on branch work; no additional worktree.
- No secrets in logs/files/docs; preserve proxy, TLS and signature verification.
- No added dependencies unless independently necessary; preserve no-key recorded behavior and live-off default.
- META_DIRECT_ENABLED=1 is explicit opt-in and needs a real key. Forwarding wins when configured.
- Runtime capabilities use optional fields in the client type for compatibility: spark/instruct/segment booleans describing configured routes.
- Source/credit/mode are truthful; no invented successful model/step/safety result.
- Implementers do not commit other agents' changes or run concurrent production builds. Root owns build/browser integration and final staging decisions.

## Review Focus

- A prior session must not defeat a new sample query or publish late extraction results.
- Malformed/stalled transport and blocked IndexedDB must always lead to bounded usable recovery.
- A jump/retry/revisit must not invent completion or reset global call budgets.
- A mobile breakpoint must not hide safety or required instructions.
- A configured key/flag is not proof of model correctness, hosted health or event eligibility.

### Task 1: session, extraction and storage

Files: src/ui/session.tsx, ExtractingScreen.tsx, sparkOnce.ts, steps-cache.ts, new focused helpers/tests in src/ui. Do not modify UploadScreen/CoachScreen/DoneScreen/CSS.

Interfaces: preserve PrepareRequest and session public methods; add optional RuntimeInfo.capabilities. SessionSummary may gain optional stepOutcomes at coach implementer's documented request. postSpark remains promise API with bounded cancellation extension if needed.

- [x] Add and run failing tests for new sample identity, terminal-state reset, stale result isolation, malformedJSON, deadline/abort, changed metadata, failed cache and correct fallback provenance.
- [x] Implement source-correct sample preparation, bounded concurrent-only dedupe, optional validated cache and explicit cap fallback.
- [x] Run focused Vitest tests; report red/green output and changed contracts.
- [x] Root reviews task result and integration regressions.

### Task 2: coach, retry and truthful outcomes

Files: src/fsm/*, src/coach/sam-scheduler.ts, src/ui/useCoach.ts, CoachScreen.tsx, DoneScreen.tsx and focused tests. Do not modify session.tsx or CSS without coordination.

Interfaces: add documented per-step outcomes in FSM; coordinate summary field shape with Task1. Preserve existing dispatch events, add explicit recheck only if needed; return paused reason and camera/retry/voice controls to CoachScreen.

- [x] Add/run failing regressions for jump→finish, duplicateSkip, Retry exhausted budget, stale timeout/result handling and coldDone.
- [x] Implement honest outcomes, bounded recheck, stale box clearing, ordinary mute, manual continuation and cold-state recovery.
- [x] Run existing FSM/scheduler/policy/UI regressions and document meaningful coverage limits.
- [x] Root reviews task result and browser outcome assertions.

### Task 3: onboarding, inputs, camera and responsive guidance

Files: src/ui/Landing.tsx, UploadScreen.tsx, InstructScreen.tsx, LiveCoachingOff.tsx, app/globals.css plus helpers/tests owned by this task. Do not modify session/coach/extraction files.

Interfaces: consume optional runtime.capabilities; preserve existing session methods. Keep recorded entry links and explicit sample labels. Use max32MiB serialized request compatibility; choose and document conservative input bounds before reading.

- [x] Add/run failing regression for hidden supervision, selected-state semantics, invalid/oversize preparation and late camera acquisition.
- [x] Implement mobile guidance parity, clearer route choices/privacy copy, early capability disclosure, bounded busy/cancelable preparation, safe camera lifecycle and working missing-camera sample links.
- [x] Run focused tests; preserve existing visual system rather than redesigning.
- [x] Root captures actual desktop/mobile flows after changes.

### Task 4: public capability and model route contract

Files: src/server/env.ts, new execution-mode helper, app/api public/internal routes, src/server/instruct.ts, forward/body-guard helpers and tests. Root coordinates this task with model worker.

Interfaces: publicRuntime returns capabilities and configuration modes; direct opt-in requires key, forwarding precedence remains. Validate runtime payloads, bound body reads and errors before model/network work. Do not modify src/server/live.ts from this task.

- [x] Add/run failing capability/mode/payload tests across key/flag/forward combinations and malformed/oversize bodies.
- [x] Implement explicit single-service direct mode, truthful configured capabilities, guarded execution and useful readiness behavior.
- [x] Run server regressions; verify no-key endpoints do not call upstream.
- [x] Document names-only config, model limits and precise remaining external prerequisites.

### Task 5: media, actual model deadlines and Gate0

Files: src/server/live.ts, spark-request.ts, sam-request.ts, scripts/gate0.ts, related model/helper tests. Do not modify public routes/instruct.ts/env.ts owned by Task4.

Interfaces: preserve model client types; accept complete supported clip and required attribution; propagate deadline failures through existing result contracts. No real model/API call in tests.

- [x] Add/run failing regressions for complete later-action clip payload, actual MIME/mode and precise SAM prompt, bounded sequential model operation, Gate0 clip+attribution.
- [x] Implement full supported input pathway, safe deadlines, correct prompts/media contract and honest first/full timing evidence.
- [x] Run focused mock client/harness tests; report actual call accounting and any unsupported modes explicitly.
- [x] Root integrates docs and obtains independent review before completion claim.

### Task 6: integrated QA, docs and closure ledger

Files: docs/hackathon-readiness.md, implementation progress log; external browser scripts/report updates. No source changes by reviewer unless a focused fix is assigned.

- [x] Independently review each task for contract/spec compliance and code quality; fix material findings.
- [x] Run full Vitest and production build with Node22; keep failures separate from external blockers.
- [x] Start the app and verify same-tab sample changes, live-off recovery, mobile warning/guidance, truthful recap, input errors, normal progression/replay/reset and camera unavailable.
- [x] Mark exact audit IDs fixed/partial/blocked/unrun. Update current runbook without rewriting the historical audit evidence.
- [x] Report material remaining credentials/network/device/event prerequisites without claiming deployment or live quality.

## Completion evidence and boundaries

Completed locally on 2026-11-02: 66 Vitest files / 442 tests, production build and TypeScript, and 16 production-browser regression tests. Independent final review findings were resolved and rechecked. The runbook records scoped fixed/partial/blocked status; these checkboxes do not claim all 95 original scenarios, real provider quality, physical phones, event eligibility, deployment or submission. A final copy clarification says the current browser coach sends workspace images. Documentation-copy validation and a production rebuild cover that last text-only change.
