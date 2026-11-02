# Hackathon readiness runbook and audit closure

Updated 2026-11-02 for the readiness implementation and Railway launch. This records source-level closure and remaining acceptance work; it is not a deployment receipt, an official eligibility assessment, or a claim that all audit scenarios passed. The original audit described the earlier tree; preserve it as historical evidence rather than reading its old failures or test counts as the current result.

Current launch status supersedes the earlier checkpoints below: [public Railway deployment](railway-launch.md), 448 passing local tests, 17 passing hosted checks, and a verified upstream model-access blocker. Earlier descriptions of provider work as unrun describe their historical stage.

## Product assessment

Reel2Real turns a tutorial into a step plan and helps a learner frame the required objects in their own workspace. Its strongest potential hackathon moment is a useful correction: an object is missing, the learner restores it, a fresh check locates it, and the learner confirms the step. The implemented reliability and truthful-state fixes improve this demonstration. The main remaining product risk is whether real localization and planning help people more than an ordinary tutorial and checklist, after camera setup and latency. The [verified project rubric](event-requirements.md) weights Impact 30%, Meta tooling 25%, Technical Depth & Execution 20% and Demo 25%. No defensible winning percentage follows without confirmed eligibility, competing entries and live evidence. Prioritize one measured live journey and observed learner benefit before expanding features.

## Current scope and truth contract

The selected primary route is an owned/permitted tutorial clip → complete plan → learner camera → explicit object recheck → learner-confirmed recap. Goal-plus-still planning remains available when configured. Recorded Samples are an explicit, credential-free backup. New domains, accounts, sharing, extra models, generalized action verification and voice navigation are deferred.

An object box proves only the corresponding detected visibility in the checked frame. It does not prove action correctness, temporal order, quantity or general safety. User confirmation, object evidence, skipped and unvisited steps are separate outcomes. Recorded, cached, mock and live result provenance remain distinct. Configuration capability is not provider health.

## Configuration prerequisites

Use Node 22 and the lockfile (`npm ci`). For local Samples, no key or camera is needed. For a single-service live app, securely bind **`META_MODEL_API_KEY`** for the intended **`api.meta.ai`** destination and explicitly set **`META_DIRECT_ENABLED=1`**. `MODEL_API_KEY` is a legacy fallback. A key alone leaves public direct calls off. Valid enabled forwarding wins per route; review [SAM-FORWARD.md](SAM-FORWARD.md) before using a worker.

Required deployment review:

- Confirm frontend/worker origin, build and intended execution route for Spark, Instruction and SAM independently.
- Verify secret bindings in the platform UI without displaying values. Do not put secrets in shell arguments, commits, screenshots or report output.
- Review `PREVIEW_PASSWORD` behavior and how judges will gain normal page/camera access. Internal worker authentication is a separate shared-secret contract.
- Check platform request-size and request-time limits against the app's accepted input; check outbound provider permissions and model access.
- Set a deliberate rehearsal/judging budget. Defaults are 200 upstream attempts/process/UTC day, 20 app requests/minute/IP, three segment requests/step allowance and 60/current coach session. One segment request can mean up to four sequential provider calls. Recheck renews only the per-step allowance.
- Build after changing `NEXT_PUBLIC_SAM_MIN_INTERVAL_MS`, `NEXT_PUBLIC_SAM_STEP_CAP` or `NEXT_PUBLIC_SAM_SESSION_CAP`; they are public client configuration.

On **2026-11-02**, the managed environment reported current enforced unrestricted HTTP access and ready `META_MODEL_API_KEY` and `META_DIRECT_ENABLED` bindings. The official event page and its linked rules both returned HTTP 200. These observations supersede the earlier blocked-domain and unapplied-draft notes; they do not establish provider authorization, successful model output or a current hosted build. Live provider proof remains unrun. See [verified event requirements](event-requirements.md): the stated submission deadline is **November 5, 2026 at 07:30 IST**, while personal eligibility, portal artifacts and project-specific prior-work questions still need resolution.

## Supported media and recovery

| Boundary | Current source contract | Acceptance limit |
| --- | --- | --- |
| Uploaded tutorial | Browser-playable MP4/WebM, >0 and ≤16 MiB, duration >0 and ≤120 seconds; first frame must decode; local preparation deadline 15 seconds | Real Safari/Android codec matrix remains unrun. Server signature validation is not full codec validation. |
| Spark video | Complete original accepted bytes; inline input up to 10 seconds/8 MiB, Files otherwise or after inline 400/413; no ffmpeg truncation | Source tests prove payload preservation, not real model action coverage. |
| Spark deadlines | One 45-second client operation across inline/file/fallback/response body; browser transport bounded; worker forwarding 60 seconds | Provider/network latency and hosted capture-to-guidance need measurement. |
| SAM | Up to four validated precise prompts; JPEG/PNG/WebP image or actual MP4/WebM video, ≤5 MiB raw, ≤8 MiB JSON | Browser coach sends JPEG keyframes; no implemented browser chunk-capture claim. |
| SAM deadline | One total ≤8-second operation across media/preparation, all nouns and full response | A fast first mask is not the same as completed multi-noun UI feedback. |
| Instruction | Goal ≤240 characters, workspace still ≤2 MiB decoded; still-derived plan marked as such | General goal quality and physical-task suitability need evaluation. |
| Cache | Validated metadata/schema/model/prompt/provenance envelope, seven-day eligibility, bounded optional IndexedDB access, clear control | Cache persistence is optional; no durable cross-refresh upload resume is promised. |
| Cap/failure | Matching cache may be reused; otherwise an explicit recorded choice with original media/credit; manual progression and bounded retry | Never label an unrelated sample as the uploaded lesson or count configuration as live output. |
| Coach | Visible recheck/mute/camera recovery; expired/stale evidence cannot verify another step; targeted safety halt preserved | Real devices, speech availability, standing viewing distance and broad accessibility remain unverified. |

Before media transmission the entry UI explains what is sent. The repository does not establish provider retention/deletion guarantees. Review stock/owned assets and the existing rights policy before submission; a credit link alone is not proof that every intended use is licensed. Keep [Sample credits](../public/samples/CREDITS.md), supervision notes, and [add-demo guidance](ADD-A-DEMO.md) intact.

## Verification commands and evidence record

Run commands in the repository with Node 22. Root owns the integrated run and production build; avoid concurrent builds in the shared checkout.

```bash
npm test
npm run build
```

Historical local results supplied by the integrating parent on **2026-11-02**, after the earlier readiness review fixes and before the current design integration:

| Check | Result | Scope |
| --- | --- | --- |
| Full Vitest suite | 66 files, 442 tests passed | Provider-independent unit/regression coverage. |
| Production build | Passed | Application at that checkpoint compiles/builds. |
| TypeScript `npx tsc --noEmit` | Passed | Type check at that checkpoint. |
| Playwright production browser suite | 16 tests passed in 25.3 seconds | Local production server, recorded data and intercepted provider-dependent cases. |
| Saved install script / normal `npm ci` | Repeated successfully with the checkpoint lockfile; 93 packages installed | Dated setup reproducibility checkpoint. |
| Independent final source review | No open material finding; final camera assertion gap fixed and closed | Source/test review, not provider/device/event acceptance. |

These are dated local results, not live provider, hosted-origin, real-phone or event eligibility evidence. The documentation-only update does not rerun those commands; root owns the final documentation-copy regression check. Save exact command, exit status, build/revision and tested mode with subsequent results rather than treating this count as permanent.

Real browser regression infrastructure is now checked in: [playwright.config.ts](../playwright.config.ts) and [readiness.spec.ts](../tests/e2e/readiness.spec.ts), with `@playwright/test` 1.64.1. Install Chromium once, then run:

```bash
npx playwright install chromium
npm run test:e2e
```

An installed browser can be selected without another browser download:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

The config uses port 3000, a local Next development server outside CI, and `npm run start` in CI. Build before the production path. It sets a 1440×1000 default viewport, reduced motion, one worker, and failure screenshots/traces. An existing local server is reused outside CI; ensure it runs the intended build/configuration. `PLAYWRIGHT_BASE_URL` changes browser targeting but does not remove the configured local server startup. Review configuration before using another target. Tests cover real browser behavior for recorded sample progression/replay, same-tab selection, jumps/unvisited recap, mobile supervision, cold Done, live-off recovery, malformed JSON retry, blocked storage, explicit cap fallback, unavailable preflight, Instruction result retry, same-step object recheck and mute. Provider-dependent responses and camera behavior are controlled/intercepted where needed. **The 16 passing browser tests do not mean all 95 audit scenarios passed.**

For the tested production-server configuration, build first and run:

```bash
CI=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Gate 0 is separate from browser acceptance. It requires `ffprobe`, `ffmpeg`, a suitable owned/permitted local MP4/WebM fixture ≤5 MiB/120 seconds and explicit attribution:

```bash
npm run gate0 -- clips/your-clip.mp4 --creator "Fixture creator" --licence self_filmed --runs 3
```

Without `--live`, ambient keys are ignored and the result is `unverified_mock`. An intentionally credentialed run adds `--live`; the CLI's opt-in does not depend on the public HTTP direct flag. Use `permission_granted` when appropriate. Metrics are `sam_still_full_ms` and `sam_clip_full_ms`, complete multi-noun response time including body. First streamed mask is explicitly **not measured**. Kitchen-specific harness prompts and schema/mask checks do not validate tutorial coverage or localization relevance. Report live/harness/browser timing separately and include actual per-noun/file/retry call accounting.

## Audit closure ledger

Status definitions: **Fixed** means the scoped source defect has an implementation and focused regression coverage, pending the final integrated run unless fresh root evidence says otherwise. **Partial** means some acceptance checks or the wider original task remain open. **Blocked/unrun** means an external prerequisite or unexecuted acceptance boundary remains; it is not a passing result. Linked tests document coverage, not a blanket result.

### Engineering

| Audit ID | Status | Source and regression evidence | Remaining boundary |
| --- | --- | --- | --- |
| ENG-01 | Partial | Explicit route gate/forward precedence: [execution](../src/server/model-execution.ts), [execution tests](../src/server/execution.test.ts), [runtime preflight tests](../src/ui/runtime-preflight.test.ts) | Runtime bindings report ready; intended route/provider authorization and hosted live success remain unrun. |
| ENG-02 | Fixed | Selection replaces old session/terminal state: [session](../src/ui/session.tsx), [session tests](../src/ui/extraction-session.test.ts), [browser scenarios](../tests/e2e/readiness.spec.ts) | Full rapid Back/Forward/device matrix is wider than the automated subset. |
| ENG-03 | Fixed | Bounded malformed/empty/cancelled transport and concurrent-only identity: [sparkOnce](../src/ui/sparkOnce.ts), [transport tests](../src/ui/sparkOnce.test.ts), [extraction tests](../src/ui/extraction-run.test.ts) | Included in the passing dated integration run; real provider recovery remains unrun. |
| ENG-04 | Partial | Input/first-frame/signature/size/duration/deadline/cancel: [preparation](../src/ui/clip-preparation.ts), [tests](../src/ui/clip-preparation.test.ts) | Physical browsers/codecs and constrained-device memory unrun. |
| ENG-05 | Partial | Complete input on inline/Files/fallback: [live client](../src/server/live.ts), [live tests](../src/server/live.test.ts), [media tests](../src/server/model-media.test.ts) | Real model coverage of a later action after second two unrun. |
| ENG-06 | Partial | Source range/replay/failure: [StepSourceVideo](../src/ui/StepSourceVideo.tsx), [playback](../src/ui/source-playback.ts), [tests](../src/ui/source-playback.test.ts) | Real mobile playback/usability acceptance unrun. |
| ENG-07 | Fixed | Optional validated cache with metadata/provenance/expiry and clear: [cache](../src/ui/steps-cache.ts), [tests](../src/ui/steps-cache.test.ts), [browser storage case](../tests/e2e/readiness.spec.ts) | Wider private-mode/device persistence combinations unrun. |
| ENG-08 | Fixed | Explicit source-correct daily-cap choice and retained draft: [extraction](../src/ui/extraction-run.ts), [screen](../src/ui/ExtractingScreen.tsx), [session tests](../src/ui/extraction-session.test.ts) | Passing browser case checks the selected sample and its original credit; hosted provider-cap acceptance remains unrun. |
| ENG-09 | Fixed | Superseded/late Instruction camera cleanup: [acquisition](../src/ui/camera-acquisition.ts), [tests](../src/ui/camera-acquisition.test.ts), [screen](../src/ui/InstructScreen.tsx) | Real delayed OS permission/interruption acceptance unrun. |
| ENG-10 | Partial | Visible step exhaustion and bounded same-step recheck: [useCoach](../src/ui/useCoach.ts), [scheduler tests](../src/coach/sam-scheduler.test.ts), [outcomes](../src/fsm/outcomes.test.ts) | Hosted missing-prop→restore→fresh-recheck and shared-budget acceptance remain unrun. |
| ENG-11 | Partial | Scoped cancellation/freshness/deadlines: [segment check](../src/ui/segment-check.ts), [tests](../src/ui/segment-check.test.ts), [deadline tests](../src/server/model-deadline.test.ts), [forward cancellation](../src/server/forward-cancellation.test.ts) | Real end-to-end multi-noun latency/stale-overlay phone behavior unrun. |
| ENG-12 | Partial | Actual media kind/signature, precise prompt, complete envelope/mask validation: [SAM](../src/server/sam-request.ts), [tests](../src/server/sam-request.test.ts), [live tests](../src/server/live.test.ts) | Provider compatibility/box relevance not live-verified. |
| ENG-13 | Fixed | Unique step outcomes and limited presence wording: [FSM](../src/fsm/machine.ts), [outcomes](../src/fsm/outcomes.test.ts), [scope](../src/fsm/status-scope.test.ts), [Done tests](../src/ui/done-screen.test.ts) | Task correctness/learning outcomes intentionally not claimed. |
| ENG-14 | Fixed | Incremental bounded body/fields/deadlines: [body reader](../src/server/request-body.ts), [validation](../src/server/request-validation.ts), [body tests](../src/server/request-body.test.ts), [deadline tests](../src/server/model-deadline.test.ts) | Hosting proxy limits/external errors need deployment acceptance. |
| ENG-15 | Partial | Per-attempt upload/response reservations and process caps: [live](../src/server/live.ts), [cap tests](../src/server/daily-cap.test.ts), [live tests](../src/server/live.test.ts) | No distributed billing/quota meter, provider retention/deletion guarantee or venue load result. |
| ENG-16 | Partial | Honest cold Coach/Done recovery: [Coach](../src/ui/CoachScreen.tsx), [Done](../src/ui/DoneScreen.tsx), [tests](../src/ui/done-screen.test.ts) | Durable resume/checkpoint/export not implemented; refresh can require restart. |
| ENG-17 | Partial | Current [README](../README.md), [forward runbook](SAM-FORWARD.md), this checklist and browser tooling | Current reviewed hosted build and clean judge-origin rehearsal remain unrun. |
| ENG-18 | Partial | Actual fixture/attribution and honest full timing: [Gate 0](../scripts/gate0.ts), [tests](../scripts/gate0.test.ts), [decisions](../src/gate0/decide.test.ts) | Credentialed live run, box relevance, lesson coverage and UI timing unrun. |
| ENG-19 | Partial | Optional preview role in [Upload](../src/ui/UploadScreen.tsx); [URL tests](../src/instagram/url.test.ts), [server tests](../src/server/instagram-show.test.ts) retained | Provider embed/private/deleted/offline/mobile matrix unrun; no automatic import/share target added. |
| ENG-20 | Partial | Ordinary mute/retry and frame/play/track deadlines: [coach camera](../src/ui/coach-camera.ts), [tests](../src/ui/coach-camera.test.ts), [screen](../src/ui/CoachScreen.tsx) | Actual phone interruption, speech and stand-distance testing unrun. |

### UX

| Audit ID | Status | Evidence and remaining boundary |
| --- | --- | --- |
| UX-01 | Fixed | Selection/recovery fixes and [browser selection/off-recovery cases](../tests/e2e/readiness.spec.ts); see ENG-02. |
| UX-02 | Fixed | Honest recap/cold state and [outcomes](../src/fsm/outcomes.test.ts), [Done tests](../src/ui/done-screen.test.ts); see ENG-13/16 limits. |
| UX-03 | Partial | Mobile instructions/hints/supervision restored in [CSS](../app/globals.css), [safety-note test](../src/ui/safety-note.test.ts), [390px supervision case](../tests/e2e/readiness.spec.ts); physical device/dynamic halt unrun. |
| UX-04 | Partial | Mobile thumbnail/dock guidance adjusted in [CSS](../app/globals.css); no inaccessible-control finding inferred from old PNGs alone. Short viewport, enlarged text, browser chrome and actual touch unrun. |
| UX-05 | Partial | [Preflight](../src/ui/runtime-preflight.test.ts), [Upload](../src/ui/UploadScreen.tsx), [Instruction](../src/ui/InstructScreen.tsx) disclose configured availability. Configuration is not health. |
| UX-06 | Partial | Distinct recorded/upload/goal choices in [Landing](../src/ui/Landing.tsx) and Upload; first-use user validation unrun. |
| UX-07 | Partial | Samples first, required native permission choices, optional details/preview: [Upload](../src/ui/UploadScreen.tsx), [entry tests](../src/ui/upload-entry.test.ts); comprehension unrun. |
| UX-08 | Partial | Accurate transmission/cache copy in entry screens/README; provider retention and final asset rights need verification. |
| UX-09 | Partial | Busy/cancel/error/draft/fallback: [preparation tests](../src/ui/clip-preparation.test.ts), [extraction tests](../src/ui/extraction-run.test.ts), [camera tests](../src/ui/camera-acquisition.test.ts); real device recovery unrun. |
| UX-10 | Fixed | Recorded work labels/result-derived status: [extraction tests](../src/ui/extraction-run.test.ts), [session status](../src/ui/session-status.test.ts), [Instruction results](../src/ui/instruct-result.test.ts). |
| UX-11 | Partial | Native radios, associated fields/status and ordinary mute implemented; complete keyboard/focus/VoiceOver/NVDA/zoom/contrast review unrun. |
| UX-12 | Partial | Visible mute/recheck and readable guidance implemented; stand-distance/gloves/physical tasks unrun; no voice progression added. |
| UX-13 | Blocked/unrun | Measured contrast/target sizes, enlarged text and varied-photo/device legibility review not completed; no accessibility-conformance claim. |

### QA packages

These are the original package IDs, not a claim that every scenario in a package is covered. Final results must name executed scenarios and distinguish mocked/intercepted behavior from live provider behavior.

| Audit package | Status | Checked-in coverage and open acceptance |
| --- | --- | --- |
| QA-01 | Partial | [Browser suite](../tests/e2e/readiness.spec.ts): five recorded progression/replay paths and selected entry/recovery behavior. Original first-use/reset matrix is wider. |
| QA-02 | Partial | Browser same-tab/off→sample plus [session tests](../src/ui/extraction-session.test.ts); complete rapid/back/forward/permutation matrix unrun. |
| QA-03 | Partial | [Transport](../src/ui/sparkOnce.test.ts), [segment](../src/ui/segment-check.test.ts), [playback](../src/ui/source-playback.test.ts): malformed/abort/deadline/retry cases. Real upstream recovery unrun. |
| QA-04 | Partial | [Cache tests](../src/ui/steps-cache.test.ts), explicit cap/blocked-storage browser cases; wider private/full/corrupt browser combinations unrun. |
| QA-05 | Partial | [Transport identity](../src/ui/sparkOnce.test.ts)/cache compatibility; wider concurrent user behavior unrun. |
| QA-06 | Partial | [Outcomes](../src/fsm/outcomes.test.ts), [scope](../src/fsm/status-scope.test.ts), [Done](../src/ui/done-screen.test.ts); full browser revisit/skip/jump matrix not all executed here. |
| QA-07 | Partial | Deterministic [acquisition](../src/ui/camera-acquisition.test.ts)/[coach camera](../src/ui/coach-camera.test.ts); actual hardware/OS permission/interruptions unrun. |
| QA-08 | Partial | [File](../src/ui/clip-preparation.test.ts)/[media](../src/server/model-media.test.ts)/[body](../src/server/request-body.test.ts)/[complete payload](../src/server/live.test.ts); device codecs/live coverage unrun. |
| QA-09 | Partial | [Execution](../src/server/execution.test.ts), preflight/provenance/auth/forward tests; real worker/provider/host acceptance remains unrun despite ready runtime bindings. |
| QA-10 | Partial | [Scheduler](../src/coach/sam-scheduler.test.ts)/[day cap](../src/server/daily-cap.test.ts)/[IP](../src/server/ip-limit.test.ts) primitives; real shared-network/billing/throughput and distributed budgets unrun. |
| QA-11 | Partial | Improved semantics/mute and reduced-motion browser setting; keyboard/screenreader/contrast/zoom review unrun. |
| QA-12 | Partial | Honest cold Done browser scenario and [Done tests](../src/ui/done-screen.test.ts); no durable checkpoint/export/share claimed. |
| QA-13 | Blocked/unrun | Runtime bindings report ready; provider authorization, actual model output and hosted acceptance remain unrun. Mock harness cannot close this package. |
| QA-14 | Partial | Chromium desktop/mobile viewport regression exists; actual iOS Safari/Android, other engines, orientation/connectivity/asset matrix unrun. |
| QA-15 | Partial | [Safety refusals](../src/safety/goal-screen.test.ts), [FSM halt](../src/fsm/machine.test.ts), mobile supervision retained; hazardous-action/general safety recognition unsupported. |

## Remaining release gates and owners

1. **PM: participant requirements and rights.** Use [verified event requirements](event-requirements.md), including the **November 5, 2026 at 07:30 IST** deadline and published rubric. Confirm accepted-participant/waiver status and track, inspect portal-specific artifacts and limits, resolve any prior-work uncertainty, and reconcile asset permissions/local rights policy. The retrieved rules do not supply a complete artifact checklist or an explicit prior-work timing rule.
2. **Platform: hosted acceptance.** Runtime bindings report ready and HTTP access is observed unrestricted. Verify the intended direct/forward route and provider model authorization, identify the current reviewed hosted build and rehearse normal judge access. Configuration readiness is not a provider-success receipt.
3. **Engineering + QA: live quality.** Use a permitted clip with a meaningful later action; inspect the whole plan; show relevant workspace localization, missing-object recovery, fresh same-step Recheck and truthful recap on the exact hosted origin. Record sanitized request IDs/status, latency distributions and actual attempted provider calls. Flags do not satisfy this gate.
4. **QA: devices and remaining matrix.** The dated local integration results above pass their scope; map that subset to the original 95 scenarios without marking unrun cases passed. Test real phones, permissions/interruption, mobile supervision, keyboard/screenreader/zoom and touch.
5. **PM/research: usefulness/demo.** Observe target learners against ordinary playback/checklists; report setup cost, interruptions, outcome and confusion without invented statistical confidence. Film one verified live loop with a clearly labelled recorded backup and test fresh judge access. Do not claim a win probability, general safety, certified actions or automatic Instagram import.

Source repair makes these checks possible; it does not replace their evidence. Work remains reviewable in the working tree, with no deployment, publication or submission implied by this ledger.

## Designeer reference follow-up

After the user published the environment, the reference and official event sources became accessible. The [reference adaptation](design-reference.md) now provides the light gallery, functional lesson categories and scoped studio screens. Fresh local verification on November 2, 2026:66 Vitest files / 442 tests passed, production build/type validation passed, and 23 production-browser tests passed in 46.9 seconds. The 7 new browser cases cover real filtering/lesson identity, mobile entry routes, count contrast and 390/800/1023/1440px layouts. Keyboard skip focus and rendered screens were also inspected. The independent review finding was closed. See [design QA](../design-qa.md) for evidence and its limits; earlier 16-test figures above are historical.

Runtime access is now enforced unrestricted and the key/direct-mode bindings report ready. No real Meta output, physical-phone acceptance, learner benefit or hosted judge access was verified by this design work. The verified deadline/rubric are in [event requirements](event-requirements.md); participant eligibility and portal details remain open. No old environment changes were reapplied or publication performed.

## Railway launch follow-up

The [public Railway app](https://web-production-d1454.up.railway.app) is deployed on `web` / `production`, with the user's approved public access and 200 provider attempts per process/day. Final deployment `050fc742-3680-4db7-af47-4051a6bc837b` reached SUCCESS. A fresh 17-check hosted recorded/browser run passed, with no camera acquisition, live inference requests or browser errors. After correcting a valid-response SAM codec adapter defect, the full local suite passed 448 tests across 66 files and the production build/type check passed.

Hosted live AI acceptance is **blocked**, rather than unrun: actual Spark and SAM calls using the deployed credential returned upstream `404 model_not_found`. The official model IDs are correct. Managed-cloud probes separately returned valid responses and confirmed the corrected decoder, but do not prove Railway credential access. Secure Railway key/model-access verification is pending; see [the launch record](railway-launch.md) for exact scope, evidence and source/redeployment notes. Real-phone camera, learner outcomes and participant/portal gates remain open.
