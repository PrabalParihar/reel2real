import type { TutorialStep } from "@/src/schema/types";
import { objectEvidenceRows, type ObjectEvidence } from "./object-evidence";

export function ObjectChecklist({ step, evidence, illustrative, recheckAvailable, onRecheck }: {
  step: TutorialStep;
  evidence: ObjectEvidence;
  illustrative: boolean;
  recheckAvailable: boolean;
  onRecheck: () => void;
}) {
  const rows = objectEvidenceRows(step, evidence);
  return (
    <section className="object-checklist" aria-label="Objects for this step">
      <div className="object-checklist-heading">
        <h2>Objects for this step</h2>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!recheckAvailable} onClick={onRecheck}>Recheck objects</button>
      </div>
      {illustrative ? <p className="quiet">Illustrative mock checks · not live camera evidence.</p> : null}
      {rows.length ? (
        <ul aria-live="polite" aria-atomic="true">
          {rows.map((row) => (
            <li key={row.objectId}>
              <span className="object-checklist-noun">{row.noun}</span>
              <span className={`object-checklist-status${row.status === "Visible in checked frame" ? " is-visible" : ""}`}>{row.status}</span>
            </li>
          ))}
        </ul>
      ) : <p className="quiet">No required objects listed for this step.</p>}
    </section>
  );
}
