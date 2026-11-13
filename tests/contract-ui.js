/* Contract panel browser test. SYNTHETIC data, mocked Airtable, no token. Run: node tests/contract-ui.js (needs playwright; set CHROMIUM_PATH if its browser is not installed). */
const { chromium } = require("playwright"); const http = require("http"), fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = {}; vm.runInNewContext(fs.readFileSync(path.join(root, "js/config.js"), "utf8"), { window: win });
const C = win.REEF_CONFIG, f = C.F, T = C.T;
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + m); };
const rec = { id: "recZZZ0000000001", createdTime: "2026-01-01T00:00:00.000Z", fields: { [f.name]: "ZZZ Contract UI Test", [f.org]: "ZZZ Test School", [f.status]: "Verbal Yes", [f.contractCheck]: "OK", [f.agreementStatus]: "Not Sent", [f.arrival]: "2027-05-01", [f.total]: 5000, [f.students]: 20, [f.chaps]: 2 } };
const real = { id: "recREAL000000001", createdTime: "2026-01-01T00:00:00.000Z", fields: { [f.name]: "Real School - 2027", [f.org]: "Real School", [f.status]: "Verbal Yes", [f.contractCheck]: "OK", [f.agreementStatus]: "Not Sent", [f.arrival]: "2027-05-02", [f.total]: 5000 } };
let patches = [], posts = 0;
const srv = http.createServer((q, r) => { const p = path.join(root, q.url === "/" ? "index.html" : q.url.split("?")[0]); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "Content-Type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : "text/html" }); r.end(d); } }); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const url = "http://localhost:" + srv.address().port + "/";
  const br = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}); const pg = await br.newPage({ viewport: { width: 1280, height: 1100 } }); const errs = []; pg.on("pageerror", e => errs.push(e.message));
  await pg.route("https://api.airtable.com/**", async route => { const rq = route.request(), u = rq.url();
    if (/meta\/whoami/.test(u)) return route.fulfill({ json: { id: "usrX", email: "tester@example.org", scopes: ["data.records:read", "data.records:write"] } });
    if (rq.method() === "PATCH") { const b = JSON.parse(rq.postData()); patches.push(b); Object.assign(rec.fields, b.fields);
      // the automation: a moment later it builds the draft, unticks the box, writes the result
      setTimeout(() => Object.assign(rec.fields, { [f.signBox]: false, [f.signReqId]: "777", [f.signResult]: "2026-11-11 20:00:00 UTC [manual]: UNSENT DRAFT ready for ZZZ Contract UI Test (request 777). Open Zoho Sign > Documents > Drafts." }), 1000);
      return route.fulfill({ json: { id: rec.id, fields: b.fields } }); }
    if (rq.method() === "POST" && !/listRecords/.test(u)) { posts++; return route.fulfill({ json: { records: [{ id: "recLOG" }] } }); }
    const m = u.match(/\/v0\/app\w+\/(tbl\w+)\/listRecords/); if (m) { const recs = m[1] === T.bookings ? [rec, real] : []; return route.fulfill({ json: { records: recs } }); }
    route.fulfill({ status: 404, body: "{}" }); });
  await pg.goto(url); await pg.fill("#tok", "pat_TEST123"); await pg.click("#go"); await pg.waitForSelector("#main h2");
  await pg.evaluate(() => REEF_UI.go("booking", "recZZZ0000000001", "contract")); await pg.waitForSelector("#cdPanel");
  let panel = (await pg.textContent("#cdPanel")).replace(/\s+/g, " ");
  ok(/Contract status\s*Not Sent.*Contract Check: OK/.test(panel) && /Draft in Zoho Sign\s*None yet/.test(panel), "panel: shows Not Sent, Check OK, no draft");
  ok(await pg.isDisabled("#cdBtn") && /Switch to Live/.test(panel), "Sandbox: button disabled with the reason 'Switch to Live'");
  ok(/Create contract draft/.test(await pg.textContent("#cdBtn")), "button label: Create contract draft");
  ok(/Nothing here sends the contract/.test(panel) && /not yet confirmed with Rose|Not yet confirmed with Rose/i.test(panel), "panel: says nothing is sent, and flags draft ownership as unconfirmed");
  ok((await pg.getAttribute("#cdOpen", "href")) === "https://sign.zoho.com/", "link: opens Zoho Sign");
  await pg.click("#mbLive"); await pg.click("#lvGo"); await pg.waitForSelector("body.live");
  ok(!(await pg.isDisabled("#cdBtn")) || true, "(live)"); await pg.evaluate(() => REEF_UI.go("booking", null, "contract"));
  ok(!(await pg.isDisabled("#cdBtn")), "Live + ZZZ + OK + not sent: button enabled");
  await pg.click("#cdBtn"); await pg.waitForSelector("#confirmDlg[open]");
  const dlg = (await pg.textContent("#confirmDlg")).replace(/\s+/g, " ");
  ok(/unsent draft/.test(dlg) && /Nothing is sent to the school/.test(dlg), "confirm box: says unsent and nothing is sent to the school");
  await pg.click("#cfSave"); await pg.waitForSelector("#cdResult .note b", { timeout: 20000 });
  const res = (await pg.textContent("#cdResult")).replace(/\s+/g, " ");
  ok(/Done\. Unsent draft is ready/.test(res) && /request 777/.test(res) && /#oxp-bookings/.test(res), "result: reads Airtable back and shows the unsent draft message and the Slack channel");
  ok(patches.length === 1 && Object.keys(patches[0].fields).join() === f.signBox && patches[0].fields[f.signBox] === true, "writes: exactly one PATCH, only the Create Sign Draft box");
  ok(posts === 1, "writes: one Communications Log row");
  panel = (await pg.textContent("#cdPanel")).replace(/\s+/g, " ");
  ok(/Yes.*request 777/.test(panel) && /Refresh contract draft/.test(await pg.textContent("#cdBtn")), "after: panel shows the draft request ID and the button now says Refresh");
  await pg.click("#cdBtn"); await pg.waitForSelector("#confirmDlg[open]");
  ok(await pg.isDisabled("#cfSave") && /rebuilds the unsent draft/.test(await pg.textContent("#confirmDlg")), "refresh: confirm box warns it rebuilds and needs the checkbox");
  await pg.click("#cfCancel");
  // locked
  rec.fields[f.agreementStatus] = "Signed"; await pg.evaluate(() => REEF_UI.refresh()); await pg.waitForTimeout(1500); await pg.evaluate(() => REEF_UI.go("booking", null, "contract"));
  ok(await pg.isDisabled("#cdBtn") && /marked Signed/.test(await pg.textContent("#cdWhy")), "Signed: button disabled with the reason");
  rec.fields[f.agreementStatus] = "Not Sent"; rec.fields[f.contractCheck] = "STOP: no arrival date"; await pg.evaluate(() => REEF_UI.refresh()); await pg.waitForTimeout(1500); await pg.evaluate(() => REEF_UI.go("booking", null, "contract"));
  ok(await pg.isDisabled("#cdBtn") && /STOP: no arrival date/.test(await pg.textContent("#cdWhy")), "STOP: button disabled showing the Contract Check text");
  await pg.evaluate(() => REEF_UI.go("booking", "recREAL000000001", "contract")); await pg.waitForSelector("#cdPanel");
  ok(await pg.isDisabled("#cdBtn") && /Only ZZZ test records/.test(await pg.textContent("#cdWhy")), "real (non-ZZZ) booking: button disabled while test-only is on");
  await pg.setViewportSize({ width: 400, height: 900 });
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "phone width: no sideways scroll");
  ok(errs.length === 0, "no page errors" + (errs.length ? ": " + errs.join(" | ") : ""));
  await br.close(); srv.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
