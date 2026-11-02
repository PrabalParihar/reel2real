# Instruction camera readiness

The user delegated the PR #17 integration decision after reviewing its overlap
with merged PR #18. Port its useful camera behavior onto current main, verify a
focused replacement, then close #17. Do not restore its session/extraction files.

Keep the current React/Next.js implementation and existing camera acquisition
controller. Mount the preview while permission is pending; attach each acquired
stream to a stable video node; enable Capture only when a real frame is readable.
Retry playback on media readiness events without treating autoplay rejection as
camera permission failure. Give first-frame arrival an eight-second deadline
starting after stream attachment. Clear all preview listeners, callbacks and
deadlines after readiness, capture, retry, unavailability and unmount. An already
ready frame must never leave a deadline that can later show a false error.

Retain the existing twenty-second acquisition deadline, late-stream disposal,
duplicate action guards, capability preflight, forty-five-second cancellable
planning, response validation, provenance, and upload/session recovery. A busy
camera must fail once with actionable copy rather than retry another constraint.
Permission, missing-device and insecure-context errors remain immediate.

Approaches considered: resolving all #17 conflicts risks replacing newer lifecycle
and planning safeguards; closing it without a replacement loses useful frame
readiness behavior. A focused port preserves those safeguards and isolates review.
No new runtime or test dependency is needed. Direct sample deep links, coach
session changes, model configuration and deployment are outside this change.

Verification covers delayed/no frames, rejected playback, already-ready capture,
retry, busy/blocked camera, unmount and late permission, plus a complete mocked
instruction-to-coach journey. Browser checks use synthetic media and intercepted
runtime/model requests; they make no real provider calls.
