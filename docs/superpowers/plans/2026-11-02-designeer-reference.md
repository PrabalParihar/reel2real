# Designeer Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement these independent file-owned tasks. Steps use checkbox syntax.

**Goal:** Apply the selected reference's light gallery style to Reel2Real's discovery and non-camera screens.

**Architecture:** Keep the existing Next/React app and all coaching state. Isolate the new appearance in CSS files loaded after globals and opt in through AppShell. Landing uses real published sample data and bounded local category filtering.

**Tech Stack:** Existing Node22, Next15, React19, TypeScript, Vitest, Playwright and lucide-react. No new dependencies.

**Spec:** ../specs/2026-11-02-designeer-reference-design.md

## Global Constraints

- Preserve prior uncommitted fixes; no setup reapplication, configuration edits, deployment, publication, commits or pushes.
- No live model calls or new assets/dependencies for visual work.
- All5 sample IDs, original media/credit, supervision, actual provenance and privacy statements remain truthful.
- CSS is scoped to studio/landing; preserve final mobile coach safe-area rules and camera behavior.
- Root owns builds and browsers; workers never run concurrent .next mutations.

## Review Focus

- Narrow390px and intermediate800/1023px layouts must remain readable without hidden overflow masking clipped controls.
- A filter must change actual displayed lesson links and preserve keyboard/selected semantics.
- Light surfaces must not make input text, warning/error copy or photo labels unreadable.
- Recorded labels, creator links and supervision must remain visible on selected cards and coach.
- All entry/recovery routes, cold states and model-independent sample journeys must work.

### Task1: record current target and browser acceptance

Root owns spec, plan and tests/e2e/design-reference.spec.ts.

- [x] Capture actual reference desktop/mobile and inspect them.
- [x] Add browser cases for real filters, navigation and390/800/1023/1440 layout boundaries; run against prior production build to establish failure. Filter case failed as expected:5 lesson cards requested,0 present in old build.

### Task2: gallery landing

Worker owns src/ui/Landing.tsx and src/ui/landing-studio.css only. Use class studio-theme on landing container; no AppShell dependency. Keep existing sample media helpers/crop/overlays and rights data. Use accessible buttons with aria-pressed for All lessons, Kitchen, Make & grow. Gallery is a labelled section with cards class lesson-card and heading Try a recorded sample. Kitchen maps masala-chai/latte-art; other samples map Make & grow. No source/model state changes.

- [x] Implement responsive reference-based gallery and functional filters.
- [x] Root inspects screenshots and scoped regressions.

### Task3: non-camera studio appearance

Worker owns src/ui/studio-theme.css, chrome.tsx, and AppShell appearance attributes in UploadScreen/InstructScreen/ExtractingScreen/DoneScreen only. New prop appearance?: studio; omitted retains current camera appearance. Scoped CSS defines light variables, form/card/error/summary treatments; photo overlays retain dark readable labels. Do not change state or API logic. Ensure current still-only transmission copy is accurate in Instruction.

- [x] Implement scoped light appearance and explicit screen opt-in.
- [x] Root imports CSS in app/layout.tsx after globals and landing CSS after studio theme; preserves existing fonts.
- [x] Root verifies forms/credits/status and camera/non-camera transition.

### Task4: integrated review and evidence

Root owns production build/browser/unit execution and final docs. Independent reviewer reads only the design diff.

- [x] Run existing unit tests and production build.
- [x] Run all existing and new browser cases against production.
- [x] Capture and inspect desktop/mobile/intermediate screenshots; resolve material issues.
- [x] Save QA report with scope and remaining provider/device/event limitations; update reference capture status.

## Completion evidence

Final production build/type validation passed; 66 unit files / 442 tests passed; 23 production-browser tests passed in 46.9 seconds. Root inspected reference and actual desktop/mobile/upload/Instruction/recap/coach screenshots plus intermediate responsive bounds. Independent count-contrast finding was fixed and verified with a red/green browser case; keyboard skip focus passed. See design-qa.md for scope and remaining real provider/device/event-participant boundaries. No configuration updates, publication, deployment, commits or pushes occurred.
