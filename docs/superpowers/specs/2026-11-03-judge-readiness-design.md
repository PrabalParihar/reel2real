# Judge readiness improvements

The user authorized research and useful enhancements toward the Meta AI Developer
Hackathon, preferring the Indie Developer track. Research refreshed November 3 IST
confirms a November 5, 07:30 IST deadline and rubric: impact 30%, Meta tooling 25%,
technical execution 20%, demo 25%. Direct public tutorial-to-camera competitors
exist. Submitted-build count, acceptance and private Discord access remain unknown.

Fresh hosted checks confirm main `a522a73` deployed on Railway and the recorded
journey works. Live instruction planning returns 502 and SAM returns upstream 404;
these are blockers to live success, not evidence that a new feature fixes the API.
Investigate network/destination/model access without changing the existing key.

Make the existing correction loop more legible with a compact current-step object
checklist, using existing results and budgets. Each required object distinguishes
not checked, visible in the checked frame, not highlighted, unavailable and expired
evidence. Pending rows remain not checked until a response; the existing coach
status indicates checking. An omitted object is unknown, not absent. Errors, stale
frames, retries and step/camera changes must not display previous positive results.
Recorded examples must not acquire a camera or be relabelled as live evidence.
Preserve manual Next/Skip and explicit Recheck; no automatic action verification.

Correct visible and spoken claims that infer skipped actions or temporal order
from still-frame object checks. Actual learner Skip remains a deliberate recorded
outcome. Instruction-derived recaps say plan from still; upload recaps retain clip
provenance. The recap's combined count includes learner confirmations and object
visibility, and must explicitly name both rather than claiming all were confirmed.

Improve explicit clip intent on mobile: Use my clip opens the real form directly,
without requiring scrolling through five examples. Retain recorded discovery and
capability/privacy/permission guidance. Make mobile filmstrip controls reachable
above the fixed Next/Skip bar; preserve supervision and full instructions.

Approach: reuse existing model results and lifecycle. Additional models, action
verification, automatic progression and broad new modes add unsupported claims
and deadline risk. No dependencies or model calls are needed for these UI changes.
Update event/competition/launch/submission evidence honestly and preserve drafts.

Verify meaningful state partitions with unit tests and browser missing-object →
fresh recheck → current-step reset, failed check, explicit mobile clip navigation,
recap provenance, and reachable thumbnail flows. Use mocked APIs for regressions;
live acceptance requires separate real-provider success and physical-task footage.
