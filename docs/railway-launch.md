# Railway launch

Public URL: **https://web-production-d1454.up.railway.app**

Current production deployment: **`d3ee4b77`**, frontend source **`756d34f`**,
forwarding privately to healthy worker **`258e0cb5`**, manually pinned source
**`234f32a`**. All three public model routes pass live acceptance, including a
valid uploaded-clip plan. A 12-second Files API clip also passes. **Useful
missing-object correction remains P0:** restored blue-card fixtures were not
detected despite successful SAM responses. Physical phones, owned real-demo footage
and learner acceptance remain open; this is not a completed learner journey.

## Current topology

- Existing `reel2real` project, production environment and public `web` service.
- `MUSE_FORWARD_ENABLED=1` and `SAM_FORWARD_ENABLED=1` select forwarding for all
  three model flows. The already-configured `SAM_FORWARD_URL` targets
  `http://meta-worker-live.railway.internal:8080/api/internal/segment`; Muse derives
  `/api/internal/instruct` and `/api/internal/spark` on the same worker.
- Healthy worker deployment `258e0cb5` serves manually pinned source `234f32a`.
  Its internal routes require the shared forwarding secret.
  The worker's public preview remains password protected. No key or secret value
  belongs in this document, logs or chat.
- Primary configured cap remains the approved **200 provider attempts per process
  per day**. The healthy worker also has **200/process/day**; old preview retains 100/process/day and is no longer the model backend.
- The existing authorized key was retained; final worker stores that same key as an
  encrypted platform secret, while forwarding-secret/password references are unchanged. No key replacement, billing-plan change or Contributor consent change
  was made to enable this path.
- Temporary diagnostics have been removed; `NODE_OPTIONS` is absent. No cloud
  environment configuration was republished for the Railway deployment.

## Verified behavior and remaining acceptance

PR #20 passed CI, **483 unit tests**, **36 production browser checks**, type
checking and the production build. Five hosted mobile recorded-flow checks passed:
clip entry, supervision text, thumbnail clearance, honest recap and restart.
These checks made zero live AI requests and do not establish camera/learner results.

The existing protected worker, reviewed source `756d34f`, then passed two real-model
checks with unchanged owned synthetic fixtures on **November 3, 03:22 IST**:

| Route | Result | Observed client time |
| --- | --- | --- |
| Internal instruction | HTTP 200; live Spark, parsed/schema-valid three-step plan, two objects per step. | 39.576 s |
| Internal segmentation | HTTP/upstream 200; live SAM, `ok:true`, one present mask, no timeout. | 2.328 s |

On the public origin at **03:26:47–03:27:09 IST**, the original instruction returned
200 with a schema-valid three-step live Spark plan in **20.893 seconds**. SAM
returned 200/upstream 200 and a decoded positive normalized box in **1.009 seconds**.
Its box IoU against this one synthetic fixture's ground truth was **0.9897**;
this does not measure general accuracy or physical technique.

The original public-model blocker is operationally resolved through forwarding.
The existing worker rejected an uploaded six-second generated QA clip: missing
`tutorialId` and nine enum errors. Local repair `2f4f8e6` supplies app-owned
identity/provenance and actual clip duration/MIME, prompts exact enums and preserves
model roles/source times under strict validation. Review passed; **501 unit tests
in 70 files**, the production build and **36 production browser tests** passed.
A separate manual worker candidate, source `fc241004`, reached Railway SUCCESS
on deployment `361b0f53` (`meta-worker`). Basic-auth and POST-only route checks
passed. Three protected model POSTs then ran once each, without retry:

| Candidate route | Result | Client time |
| --- | --- | --- |
| Clip | HTTP 200; live Spark, strict schema pass, six-second generated QA video; later blue placement represented at 3–6 seconds. | 15.1 s |
| SAM | HTTP/upstream 200; decoded bounded box on the owned synthetic fixture, IoU 0.9897. | 1.8 s |
| Instruction | Client HTTP 502; application timeout, no tutorial. Provider status/request ID unobserved. | 45.5 s |

Source `234f32a` adds only documented Spark `reasoning.effort: "low"`;
models, deadlines, token caps and retries are unchanged. Peer review passed,
**505 unit tests in 70 files**, **36 production browser tests** and the production
build/CI passed. No fixed omitted-effort default or p95 improvement is claimed.

Subsequent candidate requests returned model404, including SAM. Restoring the
prior image and equal snapshot variables did not recover that candidate, while
the existing worker still returned SAM200. The final fresh `meta-worker-live`
worker, source `234f32a`, deployment `258e0cb5`, passed all protected checks after
a credential-assignment control: the existing authorized key's rendered value was
identical before and after changing its assignment from reference to encrypted
platform secret. No key rotation occurred; the context/source-policy cause remains
unproven. The same image was retained.

| Final protected route | Result | Client time |
| --- | --- | --- |
| Instruction | HTTP 200; original fixture, valid live plan. | 20.262 s |
| Clip | HTTP 200; valid six-second generated QA plan, later blue placement at 3–6 s. | 7.689 s |
| SAM | HTTP/upstream 200; decoded synthetic-fixture box, IoU 0.989714. | 1.821 s |

Public promotion then passed all three original checks on `d3ee4b77`:

| Public route | Result | Client time |
| --- | --- | --- |
| Instruction | HTTP 200; valid live plan. | 22.790 s |
| Clip | HTTP 200; valid six-second generated QA plan, later blue step at 3.2–6 s. | 7.422 s |
| SAM | HTTP/upstream 200; decoded red-fixture box, IoU 0.989714. | 1.291 s |

A further **12-second public clip** passed in **9.97 s** through the Files API,
with independent schema validation and blue-card content at 6–11.5 s; both Files
and response provider calls returned 200. Generated QA footage is not an owned
physical lesson or learner-benefit result.

**Model-quality P0:** five calls covered generic-prompt PNG absent/restored
frames, planner-prompt PNG absent/restored frames and a restored planner-prompt
JPEG control. All three restored-frame checks missed blue (`present:false`); both
absent-frame checks were correct. All returned live HTTP/upstream200, `ok:true`
and no timeout. Raw SAM output was not retained, so provider-versus-decoder
cause is unestablished. Do not claim a successful missing→restored loop. Triage
raw controlled output and the adapter, establish recall on frozen real props and
verify a useful fresh correction on a physical phone before demo acceptance. Two planning observations
under changed execution conditions do not establish a speed improvement.

The healthy worker is **manually pinned to `234f32a`**, uses the existing key as an
encrypted platform secret, and does not automatically inherit future key changes.
Forwarding-secret/password references remain unchanged; its cap is 200/process/day,
execution flags remain off and it listens on port 8080. Its Basic-protected public
domain remains for administration. GitHub main deployments update the frontend
and old preview; they do not automatically rebuild this healthy backend.

Require an owned physical-lesson plan with later content, fresh missing-object recheck,
real phone camera permissions and an owned physical lesson. The observed
20.9- and 39.6-second plans need representative latency and timeout measurement
against the 45-second model deadline; no speed improvement is claimed.

The unused failed `meta-worker` service (`2e08ce46`) and its generated `c785`
domain were deleted after public acceptance. Exactly four services remain: `web`
(`d3ee4b77`), `web-pr`, `web-preview` (`7d21232e`) and healthy
`meta-worker-live` (`258e0cb5`). Their deployment IDs were unchanged by cleanup;
the healthy worker's Basic-protected admin domain was deliberately retained.

## Direct-process discrepancy

Before forwarding was enabled, the primary process returned instruction 502/no plan
and SAM upstream 404/no masks. Actual serialized Authorization matched the unchanged
startup/runtime key, and the replies did not redirect. Its native catalog returned
200 with no models, whereas a private Railway control listed nine and the existing
protected worker subsequently performed both model operations successfully.

The direct-process discrepancy remains unexplained. Successful worker calls
contradict a blanket Railway networking block or blanket inability of the key to
execute SAM. They do not identify a provider account/source-policy cause. The
[optional support draft](meta-access-support-draft.md) retains failed and successful
provider request IDs without asserting that direct access has been fixed.

Earlier launch receipts describe preceding direct-only deployments. The canonical
SAM decoder correction and judge-readiness UI changes are included in reviewed main.

## Evidence

Workspace receipts live under
`/workspace/reel2real-review/meta-screenshot-followup/`, including
`forward-public-acceptance/`, `existing-worker/urllib-result.json`,
`upload-acceptance/schema-diagnostic-attempt-2/` and
`actual-runtime-preload/activation-run-2/restoration.json`. Local repair evidence
is in `/workspace/reel2real-review/upload-contract/task-1-report.md` and `browser.log`.
Candidate receipts are in `stage-fc24100/summary.json` and
`candidate-acceptance-fc24100/REPORT.md`, `stage-234f32a/summary.json` and
`candidate-acceptance-234f32a/REPORT.md` and
`credential-assignment-control/{sam-gate,remaining-quality}/`,
`final-public-234f32a/ACCEPTANCE.json`, `live-files-acceptance/` and
`live-recheck-{acceptance,planner-prompt,jpeg-control}/` under the follow-up evidence directory. Recorded UI release receipts are under
`/workspace/reel2real-review/hackathon-nov3/hosted/final-release/`.

Use [current priorities](competitive-readiness.md) for PM/engineering/QA work.
Participant track/portal verification, real learner benefit, owned demo footage and
target-phone acceptance remain open; no submission receipt is claimed.
