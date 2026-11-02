# Live upload response contract

Two real six-second generated clip requests reached Spark successfully but returned no usable tutorial. The second response identified a missing `tutorialId` and nine enum errors. Goal planning and SAM already pass through the existing protected worker; this change addresses clip conversion.

The server owns tutorial identity and execution provenance. For actual clip/transcript model responses, fill a missing ID and authoritative generation metadata before strict validation. For clips, use the validated request's media type and duration and mark the source as video. Keep valid model step IDs, object IDs, roles, success checks and nonuniform source ranges intact. Do not route versioned video through the loose normalizer or the still-only instruct coercer: those rewrite meaning and timing.

The planning instruction must enumerate the existing schema's allowed domain, role, success-kind and runtime values. It must explain that server metadata and rights are supplied by the app. The JSON schema and semantic validator remain strict; unknown roles, unsupported versions, broken references and out-of-range timing still fail. Recorded/sample responses must retain curated provenance and stable IDs.

Scope is the existing Spark request builder and live response conversion, meaningful integration regressions, and current readiness/runbook/submission status documentation. No new dependencies, endpoints, models, billing consent, fallback retries or call budgets. Physical phone use, learner benefit and private submission details remain unverified.

Validation: reproduce a versioned clip without an ID through the live client; preserve its later step, required-absent role and source range; verify authoritative metadata and user credit; reject malformed semantics; keep recorded behavior unchanged. Run the unit suite, build/type checks and existing browser checks. Review before committing/deploying. Then repeat one bounded real public clip request and confirm later-scene content and clip provenance.

Staged validation confirmed the six-second clip and SAM, but an original goal-planning request reached the unchanged 45-second application timeout. Use the documented Responses `reasoning.effort: "low"` on Spark planning requests as the smallest latency-control change. Do not add a token cap, change model/deadline, or claim a guaranteed speedup. Repeat the same goal and later-scene clip acceptance after the change; schema validity and coverage are required. Official reasoning documentation: https://dev.meta.ai/docs/reasoning.
