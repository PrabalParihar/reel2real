# Live upload response contract

Two real six-second generated clip requests reached Spark successfully but returned no usable tutorial. The second response identified a missing `tutorialId` and nine enum errors. Goal planning and SAM already pass through the existing protected worker; this change addresses clip conversion.

The server owns tutorial identity and execution provenance. For actual clip/transcript model responses, fill a missing ID and authoritative generation metadata before strict validation. For clips, use the validated request's media type and duration and mark the source as video. Keep valid model step IDs, object IDs, roles, success checks and nonuniform source ranges intact. Do not route versioned video through the loose normalizer or the still-only instruct coercer: those rewrite meaning and timing.

The planning instruction must enumerate the existing schema's allowed domain, role, success-kind and runtime values. It must explain that server metadata and rights are supplied by the app. The JSON schema and semantic validator remain strict; unknown roles, unsupported versions, broken references and out-of-range timing still fail. Recorded/sample responses must retain curated provenance and stable IDs.

Scope is the existing Spark request builder and live response conversion, meaningful integration regressions, and the three readiness/runbook documents already being refreshed. No new dependencies, endpoints, models, billing consent, fallback retries or call budgets. Physical phone use, learner benefit and private submission details remain unverified.

Validation: reproduce a versioned clip without an ID through the live client; preserve its later step, required-absent role and source range; verify authoritative metadata and user credit; reject malformed semantics; keep recorded behavior unchanged. Run the unit suite, build/type checks and existing browser checks. Review before committing/deploying. Then repeat one bounded real public clip request and confirm later-scene content and clip provenance.
