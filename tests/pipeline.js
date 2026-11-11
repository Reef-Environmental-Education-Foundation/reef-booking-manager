/* Pipeline screen test. Serves the app, mocks api.airtable.com with SYNTHETIC data (invented schools, figures and dates), drives the UI.
   Run: node tests/pipeline.js   (needs playwright). Dates are relative to today so the "days out" flags do not drift. */
const { chromium } = require("playwright"); const http = require("http"), fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, ".."); const win = {}; vm.runInNewContext(fs.readFileSync(path.join(root, "js/config.js"), "utf8"), { window: win });
const C = win.REEF_CONFIG, f = C.F, T = C.T;
const mk = (id, o) => ({ id, createdTime: "2026-01-01T00:00:00.000Z", fields: o });
const iso = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
let seq = 0; const rid = () => "recPPPPPPPPPPP" + String(++seq).padStart(3, "0");
const bk = (org, detail, o) => mk(rid(), Object.assign({ [f.org]: org, [f.name]: org + " - " + detail, [f.students]: 20, [f.chaps]: 2, [f.reach]: 22, [f.total]: 10000, [f.arrival]: iso(120), [f.approved]: false }, o));
const R = {
  d1: bk("Draft Academy", "Apr 2027 - 2-Day", { [f.status]: "Quoting", [f.approved]: true, [f.total]: 5001 }),
  d2: bk("Twin School", "Mar 2027 - 2-Day Expedition", { [f.status]: "Quoting", [f.arrival]: iso(90), [f.total]: 5000 }),
  d3: bk("Twin School", "Mar 2027 - 4-Day Expedition", { [f.status]: "Quoting", [f.arrival]: iso(91), [f.total]: 9000 }),
  p1: bk("Silent Prep", "Dec 2026 - 1-Day", { [f.status]: "Proposal Sent", [f.arrival]: iso(20), [f.total]: 6000 }),
  p2: bk("Replied Prep", "Jan 2027 - 1-Day", { [f.status]: "Proposal Sent", [f.proposalSent]: iso(-5), [f.response]: "Change Requested", [f.arrival]: iso(60), [f.total]: 7000 }),
  p3: bk("Patient Prep", "Jun 2027 - 1-Day", { [f.status]: "Proposal Sent", [f.proposalSent]: iso(-3), [f.response]: "Not Yet Responded", [f.arrival]: iso(200), [f.total]: 8000 }),
  y1: bk("Yes Verbal", "Feb 2027 - 2-Day", { [f.status]: "Verbal Yes", [f.total]: 11000 }),
  y2: bk("Yes Contracted", "Feb 2027 - 2-Day", { [f.status]: "Contracted", [f.agreementStatus]: "Not Sent", [f.total]: 12000 }),
  c1: bk("Contract Out", "Mar 2027 - 1-Day", { [f.status]: "Contracted", [f.agreementStatus]: "Sent", [f.total]: 13000 }),
  c2: bk("Verbal And Sent", "Mar 2027 - 1-Day", { [f.status]: "Verbal Yes", [f.agreementStatus]: "Sent", [f.total]: 14000 }),
  c3: bk("Confirmed Beats Sent", "Mar 2027 - 1-Day", { [f.status]: "Confirmed", [f.agreementStatus]: "Sent", [f.paymentStatus]: "Invoiced", [f.total]: 15000 }),
  s1: bk("Signed No Pay", "Mar 2027 - 1-Day", { [f.status]: "Confirmed", [f.agreementStatus]: "Signed", [f.total]: 16000 }),
  s2: bk("Signed Paid", "Apr 2027 - 1-Day", { [f.status]: "Contracted", [f.agreementStatus]: "Signed", [f.paymentStatus]: "Deposit Received", [f.total]: 17000 }),
  s3: bk("In Progress School", "Now - 1-Day", { [f.status]: "In Progress", [f.paymentStatus]: "Paid in Full", [f.arrival]: iso(-1), [f.total]: 18000 }),
  x1: bk("Old Group", "2026 - 1-Day", { [f.status]: "Completed", [f.arrival]: iso(-200) }),
  x2: bk("Called Off", "2026 - 1-Day", { [f.status]: "Cancelled" }),
  z1: mk(rid(), { [f.name]: "ZZZ Test Booking", [f.org]: "ZZZ Test", [f.status]: "Proposal Sent", [f.arrival]: iso(10) })
};
const tbl = {}; Object.keys(T).forEach(k => tbl[T[k]] = []); tbl[T.bookings] = Object.values(R);
let writes = 0, pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + m); };
const srv = http.createServer((q, r) => { const p = path.join(root, q.url === "/" ? "index.html" : q.url.split("?")[0]); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "Content-Type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : "text/html" }); r.end(d); } }); });

/* ---- pure rules, no browser ---- */
const ctx0 = { window: {}, document: { getElementById: () => ({}), head: { appendChild() {} }, createElement: () => ({}) } }; vm.createContext(ctx0);
vm.runInContext(fs.readFileSync(path.join(root, "js/pipeline.js"), "utf8"), ctx0); const PL = ctx0.window.ReefPipeline;
const so = (s, c) => PL.stageOf(s, c);
ok(so("Quoting", "") === "draft" && so(null, null) === "draft" && so("Quoting", "Not Sent") === "draft", "stageOf: Quoting (or blank) is Drafting");
ok(so("Proposal Sent", "") === "proposal" && so("Proposal Sent", "Not Sent") === "proposal", "stageOf: Proposal Sent is Proposal sent");
ok(so("Verbal Yes", "") === "yes" && so("Contracted", "Not Sent") === "yes" && so("Contracted", "") === "yes", "stageOf: Verbal Yes, or Contracted without a signature, is Said yes");
ok(so("Contracted", "Sent") === "contract" && so("Verbal Yes", "Sent") === "contract" && so("Quoting", "Sent") === "contract" && so("Proposal Sent", "Sent") === "contract", "stageOf: contract Sent beats the proposal-stage statuses");
ok(so("Confirmed", "Sent") === "signed" && so("In Progress", "") === "signed" && so("Contracted", "Signed") === "signed" && so("Verbal Yes", "Signed") === "signed", "stageOf: Confirmed, In Progress or a signed contract is Signed, even over Sent");
const fl = (o, d) => PL.flagsOf(Object.assign({ status: "Proposal Sent", stage: "proposal", response: "", proposalSent: "2026-10-30", days: 100, payment: "" }, o), d || 45);
ok(fl({ days: 45 }).join() === "Program is 45 days out with no reply recorded" && fl({ days: 46 }).length === 0, "flags: no-reply flag fires at 45 days or fewer, not 46");
ok(fl({ days: -2 }).length === 0, "flags: no no-reply flag once the program date has passed");
ok(fl({ proposalSent: null }).join() === "Proposal Sent Date is blank", "flags: blank Proposal Sent Date");
ok(fl({ response: "Ready to Proceed" }).join() === "School replied: Ready to Proceed" && fl({ response: "Not Yet Responded" }).length === 0, "flags: a real reply is flagged, 'Not Yet Responded' is not");
ok(fl({ stage: "signed", status: "Confirmed", payment: "" }).join() === "Deposit/Payment Status is blank" && fl({ stage: "signed", status: "Confirmed", payment: "Invoiced" }).length === 0, "flags: signed with blank payment status");

(async () => {
  await new Promise(r => srv.listen(0, r)); const url = "http://localhost:" + srv.address().port + "/";
  const br = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}); const pg = await br.newPage({ viewport: { width: 1280, height: 1100 } }); const errs = []; pg.on("pageerror", e => errs.push(e.message));
  await pg.route("https://api.airtable.com/**", async route => { const rq = route.request(), u = rq.url();
    if (rq.method() !== "GET" && !/listRecords/.test(u)) writes++;
    if (/meta\/whoami/.test(u)) return route.fulfill({ json: { id: "usrX", email: "tester@example.org", scopes: ["data.records:read"] } });
    const m = u.match(/\/v0\/app\w+\/(tbl\w+)\/listRecords/); if (m) return route.fulfill({ json: { records: tbl[m[1]] || [] } });
    route.fulfill({ status: 404, body: "{}" }); });
  await pg.goto(url); await pg.fill("#tok", "pat_TEST123"); await pg.click("#go"); await pg.waitForSelector("#main h2");
  const navTxt = await pg.textContent("#nav"); ok(navTxt.indexOf("Today") < navTxt.indexOf("Pipeline") && navTxt.indexOf("Pipeline") < navTxt.indexOf("All bookings"), "nav: Pipeline sits directly under Today");
  await pg.click("nav button:has-text('Pipeline')"); await pg.waitForSelector("#plBoard");
  const cnt = async k => +(await pg.textContent(`#stage-${k} [data-count]`));
  ok((await cnt("draft")) === 3 && (await cnt("proposal")) === 3 && (await cnt("yes")) === 2 && (await cnt("contract")) === 2 && (await cnt("signed")) === 4, "board: column counts are 3 / 3 / 2 / 2 / 4");
  ok((await pg.textContent("#plFoot")).replace(/\s+/g, " ").includes("Not shown: 2 completed or cancelled bookings and 1 test records."), "footer: 2 completed or cancelled, 1 test record, none on the board");
  const head = (await pg.textContent("#plHead")).replace(/\s+/g, " ");
  ok(/Of 14 active bookings, 3 have a proposal out waiting on the school, 2 have a contract out waiting on a signature, and 4 are signed\. 3 are still drafts that nothing has been sent for\./.test(head), "headline sentence is built from the counts");
  const col = async k => (await pg.textContent(`#stage-${k}`)).replace(/\s+/g, " ");
  ok(/Silent Prep/.test(await col("proposal")) && !/ZZZ/.test(await pg.textContent("#plBoard")), "board: test records never appear");
  ok(/Contract Out/.test(await col("contract")) && /Verbal And Sent/.test(await col("contract")) && !/Confirmed Beats Sent/.test(await col("contract")) && /Confirmed Beats Sent/.test(await col("signed")), "board: Sent beats Verbal Yes, but Confirmed beats Sent");
  const order = (await pg.$$eval("#stage-proposal .pl-card .t", n => n.map(x => x.textContent)));
  ok(order.join() === "Silent Prep,Replied Prep,Patient Prep", "cards: sorted by arrival date, soonest first");
  const twin = await col("draft"); ok((twin.match(/one of 2 options/g) || []).length === 2 && !/Draft Academy.{0,80}one of/.test(twin), "cards: 'one of 2 options' on both Twin School cards and not on a single booking");
  ok(/Draft Academy.*Proposal page live/.test(twin) && (twin.match(/Proposal page live/g) || []).length === 1, "cards: 'Proposal page live' tag only on the approved draft");
  ok(/\$5,001 total/.test(twin.replace(/,\s/g, ",")) || /\$19,001 total/.test(twin), "column header shows the total value of its bookings ($19,001)");
  const attn = (await pg.textContent("#plAttn")).replace(/\s+/g, " ");
  ok(/Silent Prep.*20 days out with no reply recorded/.test(attn) && /Silent Prep.*Proposal Sent Date is blank/.test(attn), "needs a look: silent proposal 20 days out, blank sent date");
  ok(/Replied Prep.*School replied: Change Requested/.test(attn) && !/Patient Prep/.test(attn), "needs a look: a real reply is listed, a patient proposal 200 days out is not");
  ok(/Signed No Pay.*Deposit\/Payment Status is blank/.test(attn) && !/Signed Paid/.test(attn) && !/In Progress School/.test(attn), "needs a look: signed with blank payment listed, paid ones are not");
  ok(attn.indexOf("Silent Prep") < attn.indexOf("Replied Prep"), "needs a look: soonest program first");
  ok(!/margin|Margin|Total cost|Internal/.test(await pg.textContent("#main")), "no cost or margin on the screen in the Staff view");
  await pg.selectOption("#roleSel", "rose"); await pg.click("nav button:has-text('Pipeline')");
  ok(!/margin|Margin|Total cost|Internal/.test(await pg.textContent("#main")), "no cost or margin on the screen in the Pricing & costs view either");
  await pg.click("#stage-proposal .pl-card:has-text('Silent Prep')"); await pg.waitForSelector("#main h2:has-text('Silent Prep')");
  ok(/Silent Prep/.test(await pg.textContent("#main h2")) && (await pg.textContent("nav.side")).includes("Overview"), "clicking a card opens that booking's workspace");
  await pg.click("nav button:has-text('Pipeline')"); await pg.focus("#stage-yes .pl-card >> nth=0"); await pg.keyboard.press("Enter");
  await pg.waitForSelector("#main h2:has-text('Yes ')").catch(() => {}); ok(/Yes (Verbal|Contracted)/.test(await pg.textContent("#main h2")), "a card also opens from the keyboard (Enter)");
  await pg.setViewportSize({ width: 400, height: 900 }); await pg.click("nav button:has-text('Pipeline')"); await pg.waitForSelector("#plBoard");
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "phone width: no sideways page scroll");
  ok(writes === 0, "read-only: zero write requests to Airtable");
  ok(errs.length === 0, "no page errors" + (errs.length ? ": " + errs.join(" | ") : ""));
  { const c = fs.readFileSync(path.join(root, "js/config.js"), "utf8"); ok(/WRITES_TEST_RECORDS_ONLY:\s*true/.test(c) && /WRITES_ENABLED:\s*(true|false)/.test(c), "WRITES_TEST_RECORDS_ONLY is still true and WRITES_ENABLED is a boolean"); }
  await br.close(); srv.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
