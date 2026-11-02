# Meta access investigation — draft, not sent

Use the accepted participant support channel or Meta console for the existing team.
No message has been sent. Do not include a key in chat, support text or screenshots.

> We are building Reel2Real for the Meta AI Developer Hackathon. Our hosted service
> calls `POST https://api.meta.ai/v1/responses` with `muse-spark-1.3` and `sam-3.1`.
> Both return `404`, `invalid_request_error` / `model_not_found`, with route header
> `model-api-rust`. Please confirm the existing team's project/key has access to
> these model IDs, and whether a provider source-IP/region policy applies to the
> Railway `us-west2` deployment.
>
> Trace window: November 3, 2026, approximately 00:40 IST
> (November 2, 19:10 UTC).
> Spark request ID: `4f949318-5830-4755-bfda-f9f4f9607b7c` — 199 ms.
> SAM request ID: `647196f6-17a8-4ea3-b0e5-a27dc2ec68a2` — 211 ms.
>
> DNS resolved `api.meta.ai` successfully, outbound flow records showed no drop,
> and application logs received the provider's error envelopes and request IDs.
> The application uses direct routes and has no API-base override. These observations
> contradict a general Railway outbound block, but do not establish that the key
> is invalid. Managed-cloud successes cannot compare key identity because that
> environment can inject a different bound credential.

Additional Railway-internal control, using a server-side reference to the same web
key in `us-west2`: authenticated `GET /v1/models` returned **200, validated
`data: []`**, request ID `c7fbd628-593d-4e8e-ace0-5bc8cdff7e70`. An unauthenticated
control returned **401 `invalid_api_key`**, request ID
`a5b99672-65a2-4d97-9c54-b8f5085d86e6`. The key is accepted; no models are exposed
in its current catalog. Please investigate project/team model entitlement or a
provider source policy. Do not treat this as a request to rotate a presumed-bad key.

The next useful evidence is the team's entitlement configuration or the provider
trace of those IDs. A cross-host comparison must avoid proxy credential substitution.
Do not change model IDs arbitrarily or enable contributor-mode training consent.
After a justified fix, repeat bounded hosted plan/localization/recheck acceptance.

Track request, if the account has no self-service editor:

> I originally applied to Startup and want to change my existing application to
> Indie Developer. Your application question says tracks can be changed anytime.
> Please confirm the saved track and the appropriate edit path. I will keep one
> application and one submission.

Do not send either request until the team representative chooses the intended
account/channel. Public event pages did not reveal the participant Discord invite.
