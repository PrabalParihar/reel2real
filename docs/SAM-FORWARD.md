# SAM forward

Prod `web` gets HTTP 404 from `POST https://api.meta.ai/v1/responses` for `sam-3.1`. `web-preview` gets HTTP 200 for the same request. Paired calls in the same second showed that split. Both services use the same `META_MODEL_API_KEY` (identical key hash), the same code, the same region (`us-west2`), and static outbound IPs. The cause is on Meta's side.

Until that changes, `web` can forward `POST /api/segment` to `web-preview`. The switch is off by default. With it off, `/api/segment` calls SAM the same way it does today. The UI, demos, and samples stay the same. If the forward cannot connect or times out, the route returns the same failed segment result as a SAM failure today, and the coach shows Highlights unavailable.

The app never logs `SAM_FORWARD_SECRET`, `SAM_FORWARD_URL`, or the model key. A failed forward logs only the fixed line `SAM forward failed` or `SAM forward timed out`.

## Variables

| Name | Where | Purpose |
| --- | --- | --- |
| `SAM_FORWARD_ENABLED` | `web` only | Set to `1` to forward. Unset, empty, or any other value keeps the direct path. |
| `SAM_FORWARD_URL` | `web` only | Full URL of `POST /api/internal/segment` on `web-preview`. |
| `SAM_FORWARD_SECRET` | `web` and `web-preview` | Shared secret. `web` sends it as `x-r2r-forward-secret`. `web-preview` compares it in constant time. |

Leave `SAM_FORWARD_ENABLED` and `SAM_FORWARD_URL` unset on `web-preview`. The internal route always runs SAM itself, so the flag is not read there. Do not put the secret in the URL.

## URL choices

Preferred: Railway private networking, so the path is not public.

```text
http://web-preview.railway.internal:PORT/api/internal/segment
```

`PORT` is the port `web-preview` listens on. That is the `PORT` value on the `web-preview` service. Both services have to be in the same Railway project and environment for `railway.internal` to resolve.

Public alternative, still gated by the shared secret:

```text
https://<web-preview-public-host>/api/internal/segment
```

Basic auth is skipped only for `/api/internal/segment`. Every other page and API route still requires `PREVIEW_PASSWORD`. Prefer the private URL.

## Set them on Railway

On `web`:

- `SAM_FORWARD_ENABLED` = `1`
- `SAM_FORWARD_URL` = the private URL above, with the real port
- `SAM_FORWARD_SECRET` = a long random string

On `web-preview`:

- `SAM_FORWARD_SECRET` = the same string
- do not set `SAM_FORWARD_ENABLED`
- do not set `SAM_FORWARD_URL`
- keep `META_MODEL_API_KEY` as it already is

Save the variables, then redeploy both services. Do not copy the values into logs, shell history, or chat.

`/api/segment` checks the per-IP limit, then the 8MB body limit, then the daily cap, and only then forwards. A spent cap returns 429 and does not forward. `/api/internal/segment` checks the shared secret, then the same per-IP limit and 8MB body limit. Its daily cap is reserved inside the segment call, before any Meta request. The forward copies `x-forwarded-for` and `x-real-ip` so the per-IP limit (20 requests per minute) sees the same client. It copies no other incoming header. A body over 8MB returns 413 and is not forwarded or sent upstream.

If `SAM_FORWARD_SECRET` is unset on `web-preview`, or the header is missing or wrong, the internal route returns 404 with an empty body.

## Code on web-preview

`web-preview` has to run a build that contains `POST /api/internal/segment`. It currently runs branch `cursor/ui-v3-reels` at `9b6bc2e`. That commit matches main `dedc2df` in content, and that tree does not include this route. Point `web-preview` at this branch, or at main after this change is merged, before setting `SAM_FORWARD_ENABLED=1` on `web`.
