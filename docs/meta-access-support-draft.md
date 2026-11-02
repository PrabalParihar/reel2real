# Meta access investigation — draft, not sent

Updated **November 3, 2026 (IST)** with final public-origin acceptance and model-quality limits.
Use the existing team's accepted participant support channel or Meta console.
No message has been sent. Never include a credential, fingerprint or raw header.

## Current evidence

**All three public model routes now pass on `d3ee4b77`**, frontend source
`756d34f`, forwarding privately to manual worker `258e0cb5`/source `234f32a`.
Goal22.790 s, six-second generated clip7.422 s (later blue3.2–6 s) and red-box
SAM1.291 s (synthetic IoU0.989714) pass; a 12-second Files API clip also passes
in9.97 s with later blue6–11.5 s. Review, 505 unit tests/70 files, 36 production
browser tests, build and CI pass. See [canonical launch evidence](railway-launch.md).

**Quality P0 remains:** five SAM calls returned HTTP/upstream200 and `ok:true`; all three
restored-frame checks missed blue, while both absent-frame checks were correct.
The restored misses span generic/planner PNG and planner JPEG. Raw
SAM output was not retained, so provider-versus-adapter cause is unestablished.
Useful physical-phone correction, owned real demo and learner benefit remain open.

Earlier candidate model404s included SAM; recovery after an equal-rendered-value
credential-assignment control does not establish their context/source-policy cause.
The existing key was not rotated. The worker is manually pinned and stores that
same key as an encrypted platform secret; future key changes require explicit
worker updates. No speed improvement, paid-plan or Contributor-consent change is
claimed. Direct-process catalog/404 discrepancy remains an optional trace inquiry.

## Earlier successful traces (historical)

Production `5a52472d` previously passed the two original public fixtures:

| Public route | Result | Client time | Provider request ID |
| --- | --- | --- | --- |
| `/api/instruct` | HTTP 200; live Spark, parsed/schema-valid three-step plan. | 20.893 s | `5217f7d9-9b08-453f-96f2-b2d7d718579c` |
| `/api/segment` | HTTP/upstream 200; live SAM, one decoded positive box. | 1.009 s | `fe529f68-530b-4e22-967a-f0217381bf44` |

At **03:22:04–44 IST**, the two unchanged owned fixtures passed on protected worker
deployment `7d21232e-4f00-45c7-bf4e-cf562b9597ec`, reviewed source `756d34f`:

| Protected route | Result | Client time | Provider request ID |
| --- | --- | --- | --- |
| `/api/internal/instruct` | HTTP 200; live Spark, parsed/schema-valid three-step plan, two objects per step. | 39.576 s | `46822657-e654-4233-8793-2018fd4e39af` |
| `/api/internal/segment` | HTTP/upstream 200; live SAM, `ok:true`, one present mask, no timeout. | 2.328 s | `a64b0d39-534c-40a4-adf3-c3f1a0715f78` |

These checks used the existing forwarding secret only in memory. Primary/worker
current and snapshot key selections matched, as did their shared forwarding
secrets. They establish operational protected-worker integration on synthetic
fixtures; public acceptance is established separately above. The two planning
observations, 20.9 and 39.6 seconds, need representative latency/timeout measurement
and do not establish a performance improvement.

The user's console screenshots show active free credits and model catalog cards.
They do not establish successful inference for the deployed process. No paid-plan,
Contributor training-consent or key-rotation requirement has been established.

All private controls below used Railway `us-west2` and the server-side reference
`${{web.META_MODEL_API_KEY}}`, without exporting the credential. At **02:04:50 IST**,
`GET /v1/models` returned 200 with nine validated model IDs, including
`muse-spark-1.3` and `sam-3.1`. Generated-invalid and missing-Authorization controls
both returned 401 `invalid_api_key`.

At approximately **02:18:44–45 IST**, direct Responses controls then returned:

| Control | HTTP | Established result | Provider request ID |
| --- | --- | --- | --- |
| Minimal Spark text request | 200 | No text reply extracted; no valid application plan established. | `d7e9aa9c-bd61-4353-af70-7ba03709139c` |
| SAM, owned JPEG and `red square` prompt | 200 | Completed stream with a mask token; no decoded positive box or accuracy validation. | `e9764cea-fe0e-4b7f-80a0-afdd1d31c58f` |

However, a later public-app recheck at **02:50–02:51 IST** still returned
`/api/instruct` 502 without a plan and `/api/segment` outer 200 with `ok:false`,
upstream 404 and zero masks. Changing only SAM's prompt to the successful private
control's `red square` also returned upstream 404.

Railway's saved deployment snapshot and current rendered web variable compare
equal in memory. Separately, a temporary preload in the actual Next production
process observed both original public requests at **03:14:51–52 IST**. Its startup
native catalog GET had returned **200 with an empty model list**,
request `352f4fb8-62f8-4cb6-b2fb-77467ad07cd7`. Both Responses POSTs still returned
upstream 404 `model_not_found`.

At actual header serialization, each POST had exactly one Authorization header
matching both the startup and event-time selected runtime key; trimming left the
key unchanged and the key stayed equal across those observations. Neither reply
had a Location header. This rules against observed Next key mutation or redirect,
without identifying the provider's resolved account, entitlement or source policy.
No credential value or fingerprint was logged.

Retained network evidence shows both the successful private job and failing web
process reached `57.144.220.141:443` over IPv4, without a recorded drop cause;
partial flow records do not establish identical provider routing. Those failed
checks used direct routes and no API-base override. The diagnostic was removed
before forwarding activation; `NODE_OPTIONS` is absent. Current topology and the
preserved primary/worker caps are in [the launch note](railway-launch.md).
Deployment health does not establish successful live AI.

An earlier private control at **01:08:44 IST** (November 2, 19:38:44 UTC), request
`c7fbd628-593d-4e8e-ace0-5bc8cdff7e70`, also had an empty catalog; the later private
control exposed nine models. The newer actual-process empty catalog remains
distinct from that private result. The discrepancy is unexplained; these observations do not
support a blanket Railway outbound block, a presumed bad key or a blanket lack
of SAM access.

## Provider trace request

> We are building Reel2Real for the Meta AI Developer Hackathon. Please compare
> the successful protected-worker and private Railway requests above with the web deployment's
> `404 invalid_request_error / model_not_found` replies from the same model IDs and
> `/v1/responses` endpoint. Both carry `x-route: model-api-rust`.
>
> The latest failed web trace pair has client window November 2, 2026,
> **21:44:51–52 UTC** (November 3, **03:14:51–52 IST**): Spark
> `405eb96d-ad93-435e-a634-24918821d5ed`; SAM
> `377eff11-b520-4838-9a02-4dd295fb6172`. Both actual serialized Authorization
> headers matched the process's unchanged startup/current key, and neither reply
> redirected. The same process's native catalog returned 200 with no models,
> request `352f4fb8-62f8-4cb6-b2fb-77467ad07cd7`. Diagnostic deployment
> `d44173bd-14d4-438a-b777-5632d6d61416` ran reviewed source `756d34f`.
> Please identify the difference in resolved authorization/model routing or source
> context between these requests and the successful private controls; the current
> evidence does not identify its cause.

Forwarding now passes the original public fixtures. Repeat bounded plan,
localization and fresh-recheck acceptance on an owned physical task.
Cross-host comparisons must avoid proxy credential substitution. Do not change
model IDs arbitrarily or enable Contributor training consent as a diagnostic guess.

Track request, if the account has no self-service editor:

> I originally applied to Startup and want to change my existing application to
> Indie Developer. Your application question says tracks can be changed anytime.
> Please confirm the saved track and the appropriate edit path. I will keep one
> application and one submission.

Both requests remain drafts. The user supplied the participant
[details](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details) and
[Discord](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/discord) routes and
a server screenshot. Private announcements, saved track and current Discord role
were not inspected; the welcome screen's lock icons do not prove missing access.
