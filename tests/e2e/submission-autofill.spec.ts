import { test, expect } from "@playwright/test";
import { buildSync } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const helperPath = path.resolve("public/submission/autofill.js");
const fixture = buildSync({
  stdin: { resolveDir: process.cwd(), loader: "jsx", contents: `
    import React, {useState, useId} from 'react';
    import {createRoot} from 'react-dom/client';
    const labels=['Project Description','Public GitHub Repository','3-Minute Demo Video',
      'Describe your use of Meta products to build the submitted project',
      "Why are Meta's models important to your solution?",
      'Provide feedback from your experience using partner technologies.'];
    function App(){
      const [values,setValues]=useState(Object.fromEntries(labels.map(x=>[x,''])));
      const [tick,setTick]=useState(0);const id=useId();
      return <form onSubmit={e=>{e.preventDefault();window.fixtureSubmits=(window.fixtureSubmits||0)+1}}>
        {labels.map((label,i)=><div key={label}><label data-slot="text-field-label" htmlFor={id+i}>{label}{i<5?' *':''}</label>
          <div>{i===1||i===2?<input id={id+i} type="url" value={values[label]} onChange={e=>setValues(v=>({...v,[label]:e.target.value}))}/>
          :<textarea id={id+i} value={values[label]} onChange={e=>setValues(v=>({...v,[label]:e.target.value}))}/>}</div></div>)}
        <label>Team name<input defaultValue="witlabs" /></label>
        <label><input type="radio" name="track" defaultChecked />Indie Developer Track</label>
        <label><input type="checkbox" />Personal declaration</label>
        <button type="button" onClick={()=>setTick(tick+1)}>Re-render</button>
        <button type="button" onClick={()=>window.fixtureSnapshot=values}>Inspect state</button>
        <button type="submit">Submit</button><span>{tick}</span>
      </form>
    }createRoot(document.getElementById('root')).render(<App/>);
  ` }, bundle: true, write: false, format: "iife", platform: "browser",
}).outputFiles[0].text;

async function openFixture(page: import("@playwright/test").Page, url = "https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit") {
  await page.route(url, route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
  await page.goto(url);
  await page.addScriptTag({ content: fixture });
  await expect(page.getByLabel("Project Description", { exact: false })).toBeVisible();
  if (fs.existsSync(helperPath)) await page.addScriptTag({ path: helperPath });
}
async function fill(page: import("@playwright/test").Page) {
  return page.evaluate(async () => (window as any).reel2realFillSubmission?.());
}

test("fills blank controlled fields and retains React state after another render", async ({ page }) => {
  await openFixture(page); await fill(page);
  await expect(page.getByLabel("Project Description", { exact: false })).toHaveValue(/Reel2Real turns hands-on tutorials/);
  await page.getByRole("button", { name: "Re-render", exact: true }).click();
  await page.getByRole("button", { name: "Inspect state", exact: true }).click();
  const values = await page.evaluate(() => (window as any).fixtureSnapshot);
  expect(values["Public GitHub Repository"]).toBe("https://github.com/PrabalParihar/reel2real");
  expect(values["3-Minute Demo Video"]).toBe("https://web-production-d1454.up.railway.app/submission/reel2real-demo.mp4");
  expect(values["Why are Meta's models important to your solution?"]).toContain("Planning alone");
});

test("preserves user text, existing team and choices without checking declarations or submitting", async ({ page }) => {
  await openFixture(page);
  await page.getByLabel("Project Description", { exact: false }).fill("My edited project description");
  const result = await fill(page);
  await expect(page.getByLabel("Project Description", { exact: false })).toHaveValue("My edited project description");
  await expect(page.getByLabel("Team name")).toHaveValue("witlabs");
  await expect(page.getByLabel("Indie Developer Track")).toBeChecked();
  await expect(page.getByLabel("Personal declaration")).not.toBeChecked();
  expect(result.preserved).toContain("Project Description");
  expect(result.filled).toContain("Public GitHub Repository");
  expect(await page.evaluate(() => (window as any).fixtureSubmits || 0)).toBe(0);
});

for (const url of ["https://example.org/e/meta-ai-developer-hackathon/hackathon/submit", "https://cerebralvalley.ai/e/other-event/hackathon/submit"]) {
  test(`refuses unrelated location ${url}`, async ({ page }) => {
    await openFixture(page, url); const result = await fill(page);
    expect(result.blocked).toBe(true);
    await expect(page.getByLabel("Project Description", { exact: false })).toHaveValue("");
  });
}

test("reports missing, ambiguous and readonly controls rather than writing to another field", async ({ page }) => {
  await openFixture(page);
  await page.getByLabel("Project Description", { exact: false }).evaluate(el => el.setAttribute("readonly", ""));
  await page.getByLabel("Public GitHub Repository", { exact: false }).evaluate(el => el.parentElement!.parentElement!.remove());
  await page.evaluate(() => {
    const div = document.createElement("div"); div.innerHTML = '<label for="second-video">3-Minute Demo Video *</label><input id="second-video">';
    document.querySelector("form")!.append(div);
  });
  const result = await fill(page);
  expect(result.uneditable).toContain("Project Description");
  expect(result.missing).toContain("Public GitHub Repository");
  expect(result.ambiguous).toContain("3-Minute Demo Video");
  await expect(page.getByLabel("3-Minute Demo Video", { exact: false }).first()).toHaveValue("");
});

test("standalone bookmarklet fills its controls without external script fetching", async ({ page }) => {
  await page.goto("/submission/autofill.html");
  const bookmarklet = await page.getByRole("link", { name: "Fill Reel2Real", exact: true }).getAttribute("href");
  expect(bookmarklet).toMatch(/^javascript:/);
  await openFixture(page); await page.evaluate(() => delete (window as any).reel2realFillSubmission);
  const requests: string[] = []; page.on("request", r => requests.push(r.url()));
  await page.evaluate(code => { window.location.href = code!; }, bookmarklet);
  await expect(page.getByLabel("Project Description", { exact: false })).toHaveValue(/Reel2Real/);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => (window as any).fixtureSubmits || 0)).toBe(0);
});

for (const hidden of [false, true]) {
  test(`does not fill a nearby unrelated input when the associated control is ${hidden ? "hidden" : "missing"}`, async ({ page }) => {
    await openFixture(page);
    await page.setContent(`<section><div><label for="description">Project Description *</label>${hidden ? '<textarea id="description" hidden></textarea>' : ''}</div><div><label for="team">Team name</label><input id="team"></div></section>`);
    await page.addScriptTag({ path: helperPath });
    const result = await fill(page);
    await expect(page.locator("#team")).toHaveValue("");
    expect(result.filled).not.toContain("Project Description");
    expect(hidden ? result.uneditable : result.missing).toContain("Project Description");
  });
}

test("preserves inputs disabled by an ancestor fieldset", async ({ page }) => {
  await openFixture(page);
  await page.getByLabel("Project Description", { exact: false }).evaluate(control => {
    const field = control.parentElement!.parentElement!;
    const fieldset = document.createElement("fieldset"); fieldset.disabled = true;
    field.before(fieldset); fieldset.append(field);
  });
  const result = await fill(page);
  await expect(page.getByLabel("Project Description", { exact: false })).toHaveValue("");
  expect(result.uneditable).toContain("Project Description");
  expect(result.filled).toContain("Public GitHub Repository");
});
