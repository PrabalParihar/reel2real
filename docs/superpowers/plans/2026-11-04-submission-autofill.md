# Submission Autofill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill prepared project answers in the user's existing browser tab with one saved bookmarklet, rather than field-by-field copying.

**Architecture:** A self-contained browser function matches labels and updates blank text controls. A static page embeds that function into a draggable bookmarklet. There is no backend or account-session bridge.

**Tech Stack:** Plain browser JavaScript/HTML; Playwright with an esbuild-bundled controlled React fixture from the existing lockfile.

**Spec:** ../specs/2026-11-04-submission-autofill-design.md

## Global Constraints

- No model/runtime/dependency/credential/configuration changes.
- No credential or storage reads, network API calls, automatic submission or legal/subjective answers.
- Preserve nonempty values and existing selections; constrain the event origin/path.
- Real MP4 URL only; YouTube compatibility and actual private-page execution remain unverified.

## Review Focus

- Native setters must retain controlled React state after a separate render.
- Wrong origins/events must receive zero field mutations.
- Duplicate or missing labels must produce an honest report without filling the wrong control.
- Readonly/disabled fields and prior user edits must be preserved.
- Bookmarklet must run without fetching external scripts and must not submit the form.

## Task 1: Autofill and install page

**Files:** Create public/submission/autofill.js, public/submission/autofill.html and tests/e2e/submission-autofill.spec.ts.

**Interfaces:** Browser function window.reel2realFillSubmission(): Promise<{blocked,filled,preserved,missing,ambiguous,uneditable,invalid}>; no external arguments/state. The page generates its javascript: bookmarklet from this function's source.

- [x] Write behavioral React-fixture tests for fill/retain, preservation, origin guards, ambiguous/missing controls and standalone execution without submission.
- [x] Run the first fill test before implementation; expect blank field versus prepared description failure.
- [x] Implement the bounded function and static install page.
- [x] Run focused browser tests; expect every case passing. Run npm test/build and full browser suite once after implementation.
- [ ] Obtain independent whole-branch review, fix material findings, commit/push and merge after required CI. Deploy only the primary app's normal main build; preserve pinned worker258.
- [ ] Verify public helper and actual bookmarklet fixture execution, then provide the concrete single-install interaction without claiming the private form has already been filled.
