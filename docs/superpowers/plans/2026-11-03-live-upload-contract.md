# Live upload contract implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Track each check below.

**Goal:** Turn successful real Spark video responses into strictly valid, faithful uploaded tutorials.

**Architecture:** Populate server-owned identity, source metadata and execution provenance before the existing validator. Give Spark the exact allowed enum vocabulary; preserve model-authored step semantics and timing. Keep samples separate.

**Tech Stack:** Node 22, TypeScript, Next 15, Vitest, AJV.

**Spec:** `docs/superpowers/specs/2026-11-03-live-upload-contract.md`.

## Global Constraints

- No new dependencies, endpoints, models, billing/consent changes or extra retries.
- Schema and semantic validation remain strict.
- Preserve valid model step/object IDs, roles, success checks and nonuniform source ranges.
- Curated/sample provenance and IDs remain unchanged.
- Use the existing `muse-spark-1.3` model and existing call/deadline limits.

## Review Focus

- A video with a later step and `required_absent` must preserve both.
- Unknown roles/kinds, unsupported schema versions, broken references and out-of-range times must fail.
- Model-invented execution metadata must not replace the actual call metadata.
- Missing or malformed structural fields must not be converted into invented steps.
- Curated samples must not be relabelled as real model results.

## Task 1: Repair the model-to-app contract

**Files:** `src/server/spark-request.ts`, `src/server/live.ts`, targeted tests in `src/server/live.test.ts` or a focused new test file; prompt tests if needed.

**Interface:** Keep `buildSparkResponsesBody` and `createLiveSparkClient` public signatures unchanged. Enrich only the live response draft before `tutorialFromSparkPayload`; do not change the shared strict schema or still coercer.

- [x] Add a failing integration regression through `createLiveSparkClient` using a synthetic versioned response without an ID. Assert valid tutorial, preserved later range/IDs/absent role, correct user attribution, unique generated identity and actual clip generation metadata.
- [x] Run the regression on unchanged code and record its intended failure.
- [x] Implement minimum live-only enrichment: generate an omitted ID, set actual generation model/mode/tool call, and use validated clip media/duration with `stillPlaceholder:false`. Preserve other content; malformed existing IDs stay invalid. Avoid touching curated/sample payloads.
- [x] Extend the base planning instruction with the schema's exact allowed enum values and tell it which metadata the server supplies. Preserve goal safety guidance and complete video bytes.
- [x] Verify rejection of unknown role/kind, unsupported version, broken object references and a step beyond the actual clip duration; verify recorded/sample provenance is stable. Keep server-side validation diagnostics limited to bounded paths/messages if needed, never raw model/media/header data.
- [x] Run targeted tests, then `npm test` and `npm run build` under Node 22. Report exact results; root runs browser verification after review.
- [x] Write the implementation report and hand off the diff for review. Do not commit, push, deploy or invoke real models; root integrates after review and current live acceptance.

## Task 1b: Bound reasoning effort for practical planning latency

**Files:** `src/server/spark-request.ts`, `src/server/spark-request.test.ts`.

- [x] Add a failing request-contract test covering goal/image, inline clip, Files reference and transcript requests: each carries `reasoning: { effort: "low" }` alongside its unchanged input and model.
- [x] Observe the intended failure, then add only `reasoning: { effort: "low" as const }` to `buildSparkResponsesBody`'s returned object. No token cap, sampling option, model change, retries or deadline changes.
- [x] Run targeted tests, full unit suite and build under Node 22. Commit only after fresh review; root performs same-fixture real goal/clip quality and latency verification on the existing staging worker.

## Task 2: Verify the release and refresh evidence

Use a dedicated manually uploaded candidate worker because the existing worker tracks GitHub main and can rebuild on merge. Use the existing root start command with `PORT=8080`; the production build's default `npm start` was verified on both IPv6 and IPv4 locally. Verify the actual worker bind before promotion. The platform rejects new legacy config-file selectors, so no custom config selector or project-wide IaC migration is needed. Preserve the existing worker until protected candidate acceptance and primary forwarding promotion pass. Keep keys and forward authentication as server-side Railway references. No new model endpoints or credentials are introduced.


- [ ] Root reviews the full diff and existing browser checks; resolve material findings.
- [ ] Commit/push the reviewed source and updated runbook/readiness evidence under the user's existing authorization.
- [ ] Deploy the same reviewed revision to the protected worker and primary while preserving forward flags, secrets and call caps.
- [ ] Repeat one generated six-second public video request, retaining typed errors if it fails. Confirm real video provenance and the blue object/action introduced after three seconds. Keep synthetic QA separate from physical learner claims.
- [ ] Finalize docs and report actual release evidence and remaining physical/portal tasks.
