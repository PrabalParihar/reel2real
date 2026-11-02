# Frontend and model worker forwarding

Forwarding is an optional deployment mode for SAM and Muse Spark/Instruction. A single service can instead use explicit direct mode. This runbook describes the current source contract; it does not assert that any named deployment is configured or that a provider/network problem has been diagnosed.

## Select a mode

Public live routes default off. A key by itself does not enable direct execution. For a single service, securely bind `META_MODEL_API_KEY` (or fallback `MODEL_API_KEY`) and set `META_DIRECT_ENABLED=1`. Leave forwarding flags off. A configured key must still be real, authorized and usable against the intended provider.

For each public route, a valid enabled forward takes precedence over direct mode. Forwarding needs an HTTP(S) worker URL without embedded username/password, a nonblank shared secret, and the exact applicable flag. Muse additionally needs the segment-path URL form below, without query or fragment. If no valid forward is selected, explicit direct configuration can be selected; otherwise the route remains off. Once forwarding is selected, an error or timeout does **not** trigger a direct retry. See [model-execution.ts](../src/server/model-execution.ts).

`/api/runtime` reports configured `capabilities` and `execution` modes only. It neither contacts the worker nor verifies Meta access. Successful Sample replay never proves a forward works: recorded Sample requests always stay local.

## Names-only configuration

| Name | Frontend service | Worker service |
| --- | --- | --- |
| `SAM_FORWARD_ENABLED` | Exactly `1` to forward `/api/segment`. Otherwise no SAM forward. | Leave unset; internal routes do not use this flag. |
| `MUSE_FORWARD_ENABLED` | Exactly `1` to forward `/api/spark` and `/api/instruct`. Otherwise no Muse forward. | Leave unset. |
| `SAM_FORWARD_URL` | Full URL ending `/api/internal/segment`; one shared worker base supplies all three routes. | Leave unset to avoid an unintended public forward configuration. |
| `SAM_FORWARD_SECRET` | Secure server-only binding; sent as `x-r2r-forward-secret`. | Same secret binding; each internal route verifies it in constant time. |
| `META_MODEL_API_KEY` | Not needed for forward-only execution. Required if independently enabling direct execution here. | Real server-only credential for provider requests; `MODEL_API_KEY` is a fallback. |
| `META_DIRECT_ENABLED` | Set to `1` only if direct execution is intentionally allowed when a forward is not selected. | Not required by secret-authenticated internal routes; use only if intentionally enabling this worker's own public direct routes. |
| `META_DAILY_CALL_CAP` | Frontend reservation budget, per process/UTC day. | Actual upstream-attempt budget, per process/UTC day. |
| `PREVIEW_PASSWORD` | Optional normal preview gate. | Optional normal preview gate. Internal routes use the shared secret instead. |

Keep secret values out of URLs, repository files, command arguments, screenshots, chat and logs. Use the platform secret manager. Configure credentials for the intended `api.meta.ai` destination; `META_API_BASE` overrides the Responses destination and must be reviewed deliberately. The Files API remains on `api.meta.ai`.

## Worker URL and routes

For Railway services in the same project/environment, private networking is preferred. Set `SAM_FORWARD_URL` to the worker's private host and listening port followed by `/api/internal/segment`. If private routing is unavailable, use the worker's HTTPS host with that exact path. Do not add credentials, query parameters or fragments.

| Public route | Forward flag | Worker route |
| --- | --- | --- |
| `/api/segment` | `SAM_FORWARD_ENABLED` | Exact `SAM_FORWARD_URL` |
| `/api/spark` | `MUSE_FORWARD_ENABLED` | Same base with `/api/internal/spark` |
| `/api/instruct` | `MUSE_FORWARD_ENABLED` | Same base with `/api/internal/instruct` |

All three worker routes must exist in the deployed build. Do not rely on a historical branch name or commit. Internal requests use the same JSON media/validation contract as public requests and propagate cancellation. Worker internal execution uses its credential directly; it does not forward again. An absent/mismatched shared secret returns an empty 404. Normal preview Basic auth is bypassed only for these three exact internal paths; it is not a substitute for the shared-secret check.

Forward requests copy content type and the two client-IP headers used by the app limiter; they do not copy arbitrary incoming authorization/cookies. Redirects are handled manually so a worker redirect is not silently followed with the secret.

## Bounds, budget and failure behavior

- Segment JSON is capped at 8 MiB; decoded media is capped at 5 MiB. Spark transport JSON is capped at 32 MiB. Instruction has a stricter serialized limit of `ceil(2 MiB × 4/3) + 4096` bytes and a 2 MiB decoded still limit. Uploaded lesson video is capped at 16 MiB/120 seconds. Bodies are read incrementally with a bounded read deadline, so false or absent Content-Length does not bypass the limit.
- SAM forwarding has one total deadline of at most 8 seconds, matching the worker's complete multi-noun operation. Noun count does not multiply it. Muse forwarding has a 60-second transport deadline; the Spark client itself and browser planning/preparation transports have their own shorter deadlines.
- Public and internal model routes enforce the app's per-IP limiter (20/minute, shared across model routes in each process). Frontend segment forwarding reserves up to four prompt calls; worker live execution reserves each actual provider attempt. Muse forwarding reserves one frontend operation; the worker also counts actual inline/file/fallback attempts. These are separate process counters, not a distributed account-wide provider quota or billing meter.
- A spent daily budget returns 429 before further upstream work. Oversize serialized input returns 413. Invalid input returns a stable error. Selected forward connection/timeout failures do not create synthetic successful results. SAM degradation has no invented box; Muse errors offer retry/recorded recovery. The UI permits manual progression with truthful provenance and preserves applicable targeted safety halts.
- Logs redact model credentials. Forward-failure messages use fixed text. Review sanitized status/path/request IDs when debugging; never dump environment variables or raw credentials.

## Deployment and verification order

1. Build and deploy matching frontend/worker route contracts using Node 22. Confirm the worker contains all enabled target routes.
2. Bind worker model credential and the shared secret securely. Bind the same shared secret and intended worker URL on the frontend. Select only the desired forward flags; avoid accidental direct fallback configuration.
3. Review and save/publish any platform requirement draft before assuming it is applied. Restart/redeploy services for environment changes; rebuild for `NEXT_PUBLIC_*` browser settings.
4. Inspect `/api/runtime` for expected per-route configured modes and absence of secrets. This is configuration evidence only.
5. With an owned/permitted supported clip, intentionally run the hosted primary journey: complete plan, learner camera, current object check, missing object, fresh same-step Recheck, manual Next and truthful recap. Record exact build/origin, sanitized request IDs/status, total timing and call budget. Do not use an intercepted browser test or recorded Sample as live evidence.
6. Rehearse worker-offline, wrong-secret, timeout, malformed/oversize and exhausted-budget recovery. A failing forward must not silently retry direct. Confirm normal preview access and judge access separately from internal authentication.

Current network access, real credentials and hosted success must be established in the execution environment; this document does not certify them. See [hackathon-readiness.md](hackathon-readiness.md) for the audit closure ledger and external gates.
