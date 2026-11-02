# Railway launch

Public URL: **https://web-production-d1454.up.railway.app**

Latest observed baseline: **November 3, 2026 (Asia/Calcutta)**, deployment
`4b0c48cc-d948-416f-9fc7-801d6291dd9c`, main `a522a73` (PR #19). Railway reports
SUCCESS and the latest camera-readiness source is deployed. This observation
predates the judge-readiness enhancement branch; later receipts must identify
their own reviewed revision.

Fresh representative hosted acceptance captured 14 inspected screenshots: landing,
mobile source entry, recorded Next/Skip/recap/replay, sample switching, supervision
and cold-route recovery. There were no page errors or failed browser requests.
Recorded progression worked; real hosted instruction returned **502**, while SAM
returned outer 200 with **`ok:false`, upstream404**. Configured capability or an
outer 200 is not a successful model result.

PR #19 verification passed 458 unit tests, 31 browser regressions and build.
Enhancement evidence is recorded separately in its plan/PR. Physical-phone and
learner testing remain separate. See [current priorities](competitive-readiness.md).

## Historical November 2 launch checkpoint

The following counts and old deployment `050fc742-3680-4db7-af47-4051a6bc837b`
belong to the earlier launch; that deployment has since been replaced.

- Existing `reel2real` project, `production` environment, `web` service reused.
- User approved public access and live AI with 200 provider attempts per server process/day. Password gate removed; direct mode enabled; forwarding disabled.
- Railway build/type validation passed. Latest local suite: 66 files, 448 tests passed.
- Fresh hosted browser acceptance: 17 checks passed, 0 failed. Real HTTPS pages/assets/runtime, all five recorded lessons, truthful recaps/restart/jumps, sample switching/credits/media, category filters, mobile supervision/controls, four responsive widths and cold-route recovery passed.
- Recorded acceptance acquired no camera, made no segment/instruction requests, intercepted no API responses and recorded no browser errors. Optional web fonts were blocked for deterministic captures. Physical-phone camera testing remains separate.

## Live AI blocker

The deployed service's real Spark and SAM requests returned upstream `404 model_not_found`. Current official Meta documentation confirms the configured identifiers `muse-spark-1.3` and `sam-3.1`; changing model names or silently selecting contributor mode is not justified.

The November 3 investigation kept the existing key unchanged. Provider replies
carried `model_not_found`, `model-api-rust` and request IDs in 199/211 ms; Railway
resolved the intended `api.meta.ai` host and flow records showed no drop. This
contradicts a general Railway DNS/TCP/TLS/egress block. It does not establish that
the key is invalid: project/model access or a provider source policy remains to
be resolved. See the [sanitized support draft](meta-access-support-draft.md) for
exact request IDs. Do not replace credentials or model IDs merely on this evidence.
No key value belongs in chat, logs or repository files.

A private Railway diagnostic used a server-side reference to the existing web key
in the same `us-west2` region. A schema-validated authenticated `GET /v1/models`
returned **200 with `data: []`**; the unauthenticated control returned **401
`invalid_api_key`**. The key was present, reference-resolved and unchanged by trim.
The key is accepted, but neither required model is visible in that catalog.
Request IDs: authenticated `c7fbd628-593d-4e8e-ace0-5bc8cdff7e70`, control
`a5b99672-65a2-4d97-9c54-b8f5085d86e6`. This excludes a parser artifact and general
Railway network blocking; Meta team/project entitlement or provider source policy
still needs resolution. The earlier parser-limited result is superseded.

All four temporary diagnostic services were removed and verified absent; existing
service deployment IDs were unchanged. Credentials were never exported and no
inference POSTs were made by those jobs. After a justified access remediation,
repeat real hosted plan/localization/recheck and physical-device acceptance.

Independent probes using the managed cloud credential context returned completed Spark and SAM responses for a self-generated synthetic JPEG. Spark normalizes to a valid three-step plan. The SAM response exposed an encoding-marker/dimension adapter defect, which was fixed and deployed with canonical positive, empty, non-square, lossless, malformed and size-limit regressions. Full-client replay now returns the expected red-square box. These checks establish the corrected contract, not hosted credential success or physical-task quality.

## Evidence and redeployment

Workspace evidence is in `/workspace/reel2real-review/hosted/acceptance-after-sam-fix.json`, with 17 screenshots and deployment ID. The deployment receipt and non-secret target/settings metadata are in `RAILWAY-DEPLOYMENT-STATUS.md` and `RAILWAY-DEPLOYMENT-TARGET.json` in that review folder.

The exact uploaded source is recorded in `RAILWAY-SOURCE-MANIFEST-SAM-FIX.json` and backed up at `/workspace/reel2real-deployed-source.tar.gz`. The initial deployment used the working tree, including new source files. Future GitHub-triggered deployments must include this launch source and the canonical SAM decoder correction. This launch note was added after the application upload and does not change runtime code.

No cloud-environment configuration changes or publication were performed during Railway deployment. Participant eligibility, portal artifacts, real learner benefit and target-phone acceptance remain tracked in [the readiness ledger](hackathon-readiness.md).
