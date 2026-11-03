/* Self-contained: the install page embeds this function in a saved bookmark. */
window.reel2realFillSubmission = async function reel2realFillSubmission() {
  const result = { blocked: false, filled: [], preserved: [], missing: [], ambiguous: [], uneditable: [], invalid: [] };
  const show = (message) => {
    document.getElementById("reel2real-autofill-report")?.remove();
    const panel = document.createElement("aside");
    panel.id = "reel2real-autofill-report";
    panel.setAttribute("role", "status");
    panel.style.cssText = "position:fixed;left:16px;top:70px;z-index:2147483647;max-width:min(380px,calc(100vw - 32px));max-height:70vh;overflow:auto;padding:18px;background:#fff;color:#172238;border:2px solid #2165f5;border-radius:12px;box-shadow:0 8px 30px #0004;font:14px/1.5 system-ui,sans-serif;white-space:pre-line";
    const close = document.createElement("button");
    close.type = "button"; close.textContent = "Close";
    close.style.cssText = "float:right;margin:0 0 8px 12px;padding:4px 9px;cursor:pointer";
    close.addEventListener("click", () => panel.remove());
    const title = document.createElement("strong"); title.textContent = "Reel2Real form helper";
    const body = document.createElement("p"); body.textContent = message;
    panel.append(close, title, body); document.body.append(panel);
  };
  if (location.origin !== "https://cerebralvalley.ai" || !/^\/e\/meta-ai-developer-hackathon\/hackathon\/(?:submit|[a-z0-9-]+\/edit)\/?$/i.test(location.pathname)) {
    result.blocked = true;
    show("Open your signed-in Meta hackathon submission form, then click the saved bookmark there. No form fields were changed.");
    return result;
  }
  const fields = [
    ["Project Description", "Reel2Real turns hands-on tutorials into a step guide beside the learner's workspace. Beginners often pause and replay lessons while their hands are occupied. Upload a permitted short video and Muse Spark creates structured instructions from the complete clip, or start with a goal and one workspace still. SAM 3.1 checks camera keyframes for the objects needed in the current step. Learners can reframe, recheck, confirm with Next or choose Skip. The recap separates learner confirmations, object visibility, skipped steps and unvisited steps. Five clearly labelled recorded Samples work without a camera or live inference. The deployed prototype demonstrates real Meta API planning and controlled object localization. Detection can miss visible objects; a highlight does not verify technique or action completion. Physical-device trials and learner evaluation remain next steps."],
    ["Public GitHub Repository", "https://github.com/PrabalParihar/reel2real"],
    ["3-Minute Demo Video", "https://web-production-d1454.up.railway.app/submission/reel2real-demo.mp4"],
    ["Describe your use of Meta products to build the submitted project", "Reel2Real uses Muse Spark 1.3 and SAM 3.1 through the Meta Model API. Muse Spark turns a complete supported tutorial video into a schema-validated step plan; short clips use inline video and longer or larger accepted clips use Meta's Files API. A separate instruction mode plans from a goal and one workspace still. SAM 3.1 receives JPEG camera keyframes and text prompts derived from the current step to localize relevant objects. The interface displays the returned object evidence and supports fresh rechecks, learner confirmation and manual recovery. Model credentials stay server-side. Validation, deadlines, cancellation and usage budgets bound inference. Live results, cached plans and recorded Samples retain distinct provenance."],
    ["Why are Meta's models important to your solution?", "The solution needs both lesson understanding and evidence about the learner's workspace. Muse Spark supplies an instructional sequence from tutorial media or a goal and still. SAM 3.1 connects each step to objects visible in the current camera frame. Planning alone cannot provide current object locations, while localization alone cannot supply the lesson's sequence. Together they support tutorial-to-step-to-workspace guidance, fresh object rechecks and learner-confirmed progress. Detections can miss objects, and object visibility does not prove correct technique, action completion or safety."],
    ["Provide feedback from your experience using partner technologies.", "Not applicable: this prototype uses the Meta Model API and Railway. We did not integrate Fireworks, Modal or Baseten, so we cannot provide firsthand feedback on those partner technologies."],
  ];
  const normalize = (text) => text.normalize("NFKC").replace(/[’‘]/g, "'").replace(/\*/g, "").replace(/\s+/g, " ").trim().replace(/[?:.]$/, "").toLowerCase();
  const editableText = (element) => element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && ["text", "url", "search"].includes(element.type));
  const labels = [...document.querySelectorAll("label,[data-slot='text-field-label']")];
  for (const [name, value] of fields) {
    const matches = new Set();
    let associatedButUnavailable = false;
    for (const label of labels.filter((element) => normalize(element.textContent || "") === normalize(name))) {
      const linked = label.control || (label.htmlFor ? document.getElementById(label.htmlFor) : null);
      if (!linked) continue;
      if (!editableText(linked) || !linked.getClientRects().length) { associatedButUnavailable = true; continue; }
      matches.add(linked);
    }
    if (matches.size === 0) { (associatedButUnavailable ? result.uneditable : result.missing).push(name); continue; }
    if (matches.size !== 1) { result.ambiguous.push(name); continue; }
    const control = [...matches][0];
    if (control.value.trim()) { result.preserved.push(name); continue; }
    if (control.matches(":disabled") || control.readOnly) { result.uneditable.push(name); continue; }
    if (control.maxLength >= 0 && value.length > control.maxLength) { result.invalid.push(name + ": prepared answer exceeds this field's character limit"); continue; }
    const prototype = control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (!setter) { result.uneditable.push(name); continue; }
    setter.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (control.value !== value) { result.uneditable.push(name + ": value was not retained"); continue; }
    result.filled.push(name);
    if (!control.checkValidity()) result.invalid.push(name + ": " + control.validationMessage);
  }
  const lines = [
    "Filled " + result.filled.length + " blank project fields. Preserved " + result.preserved.length + " existing entries.",
    ...["missing", "ambiguous", "uneditable", "invalid"].filter((key) => result[key].length).map((key) => key + ": " + result[key].join("; ")),
    "Team, track, ratings and declarations were not changed. This helper has not submitted the form.",
    "The demo is a real 2:03 MP4 link. If the portal requires YouTube, upload that video and replace the link; no YouTube URL has been invented.",
    "Check any remaining required fields, then use the portal's Submit button. Only its confirmation establishes submission.",
  ];
  show(lines.join("\n\n"));
  return result;
};
