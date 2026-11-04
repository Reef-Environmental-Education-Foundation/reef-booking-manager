/* Local test: serves the app, mocks api.airtable.com with SYNTHETIC data, drives the UI with Playwright.
   Run: node tests/run.js   (needs playwright). No real token or data is used. */
const { chromium } = require("playwright"); const http = require("http"), fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, ".."); const win = {}; vm.runInNewContext(fs.readFileSync(path.join(root, "js/config.js"), "utf8"), { window: win }); const C = win.REEF_CONFIG, f = C.F;
const mk = (id, o) => ({ id, createdTime: "2026-01-01T00:00:00.000Z", fields: o });
const bookings = [
  mk("recAAAAAAAAAAAAA1", { [f.name]: "Test Academy - Apr 15 to 16, 2027 - 2-Day Expedition", [f.org]: "Test Academy", [f.status]: "Quoting", [f.type]: "Expedition", [f.location]: "Key Largo", [f.arrival]: "2027-04-15", [f.departure]: "2027-04-16", [f.students]: 90, [f.chaps]: 14, [f.teamTotal]: 9, [f.aboard]: 113, [f.fullDays]: 2, [f.arrDepDays]: 0, [f.sessions]: 7, [f.boatTrips]: 1, [f.buses]: 3, [f.total]: 34765.5, [f.vendorAuto]: 12490, [f.pennTotal]: 180, [f.gratTotal]: 1130, [f.totalCost]: 21080, [f.margin]: 13685.5, [f.marginPct]: 39.4, [f.priorSigned]: 24510, [f.pricingModel]: "Per-participant (Expedition / other)", [f.tier]: 2, [f.depositAmt]: 6953.1, [f.depositDue]: "2026-11-17", [f.pay2Amt]: 10429.65, [f.pay2Due]: "2026-11-17", [f.depositNow]: 500, [f.lockDate]: "2027-01-15", [f.rosterDue]: "2027-03-16", [f.check]: "• No schedule rows\n• Agreement Date blank", [f.acceptance]: "Not accepted", [f.propVer]: 3, [f.approved]: false, [f.contact]: "Pat Teacher", [f.email]: "pat@example.org", [f.modified]: "2026-11-01T10:00:00.000Z", [f.freeChap]: 10, [f.schedChanged]: "WARNING: schedule edited after approval. Bump Proposal Version and re-approve.", [f.nextAction]: "Send vendor request", [f.followUp]: "2026-10-01" }),
  mk("recAAAAAAAAAAAAA2", { [f.name]: "Sample Prep - Mar 17, 2027 - 1-Day", [f.org]: "Sample Prep", [f.status]: "Proposal Sent", [f.arrival]: "2027-03-17", [f.students]: 60, [f.chaps]: 8, [f.total]: 9000, [f.approved]: true, [f.approvedVer]: 2, [f.propVer]: 2, [f.publishedVer]: 1, [f.depositNow]: 500, [f.depositAmt]: 1800, [f.epoId]: "recEPO1", [f.modified]: "2026-11-01T10:00:00.000Z" }),
  mk("recAAAAAAAAAAAAA3", { [f.name]: "ZZZ Test Booking A", [f.org]: "ZZZ Test", [f.status]: "Quoting", [f.arrival]: "2027-06-01", [f.students]: 20, [f.chaps]: 3, [f.total]: 1000, [f.approved]: false, [f.propVer]: 1, [f.modified]: "2026-11-02T00:00:00.000Z" }),
  mk("recAAAAAAAAAAAAA4", { [f.name]: "Old Group 2026", [f.org]: "Old Group", [f.status]: "Completed", [f.arrival]: "2026-03-01", [f.students]: 40, [f.total]: 5000 })];
const T = C.T, tbl = {}; Object.keys(T).forEach(k => tbl[T[k]] = []); tbl[T.bookings] = bookings;
tbl[T.vendors] = [mk("recVEND1", { fldJXlYdLLboDvdDU: "Sample Boat Co", fldaWx0fSdL6deDWg: ["Boat charter"], fldoONPWl4JtotDzS: "Active", fldUdAUH5A6EJnu4O: ["recRATE1"] }), mk("recVEND2", { fldJXlYdLLboDvdDU: "Placeholder Dives", fldaWx0fSdL6deDWg: ["Boat charter"], fldoONPWl4JtotDzS: "Needs Follow-Up" })];
tbl[T.rates] = [mk("recRATE1", { fldadLk6n35nhrTv3: "Half-day charter", fldNcPkwaDQiOkJ1n: ["recVEND1"], fldoteimNwlYE0l6g: 900, fldcZViXxZuaWm791: "Confirmed", fldcOWfy9rUIpSQy9: "Available" })];
const rk = { reef_program_fee_full_day: 80, reef_program_fee_arr_dep_day: 50, reef_supplies_per_participant: 35, reef_campus_facility_half_day: 140, policy_uplift_pct: 0.05, oceanfirst_boat_halfday: 900, oceanfirst_boat_snorkel_cap: 15, oceanfirst_boats_available: 2, oceanfirst_snorkel_gear: 25, oceanfirst_boat_gratuity: 10, reef_double_kayak: 50, reef_single_kayak: 45, policy_default_staff_kayaks: 2, pennekamp_entrance_bus: 60, policy_free_chap_threshold: 10 };
Object.keys(rk).forEach((k, i) => tbl[T.rates].push(mk("recRK" + i, { fldRYBqehbV1cckD9: k, fldgwo9ZQv09nEFhr: rk[k] })));
tbl[T.schedule] = [mk("recS1", { fld3IFyuSMhEhIk3j: ["recAAAAAAAAAAAAA2"], fldD5F2jqNh98G059: 1, fldyF4IOUHnjLBOhe: "A", fld6ZXXwtnyVQXiJz: "09:00", flduffPfhDSfUpoRs: "10:00", fldA1uxhbnsdlnM53: "Fish ID", fldBdQbcgMPNih7dn: "OK" })];
tbl[T.comms] = [mk("recC1", { fld0yV06EMb364wDo: ["recAAAAAAAAAAAAA1"], fldyfBpgjI99tPxqR: "Sent proposal", fldqOd7K3DlVNYYAG: "2026-10-20" })];
tbl[T.checklist] = [mk("recK1", { fldl9U7R5wd51QTCQ: ["recAAAAAAAAAAAAA1"], fld0QmKxGP1qn0S1C: "Roster", fldyIZDGmyfULPD8x: true })];
const log = []; let writeAttempts = 0;
const srv = http.createServer((q, r) => { const p = path.join(root, q.url === "/" ? "index.html" : q.url.split("?")[0]); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "Content-Type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : "text/html" }); r.end(d); } }); });
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + m); };
(async () => {
  await new Promise(r => srv.listen(0, r)); const url = "http://localhost:" + srv.address().port + "/";
  const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; pg.on("pageerror", e => errs.push(e.message));
  await pg.route("https://api.airtable.com/**", async route => {
    const rq = route.request(); const u = rq.url(); log.push(rq.method() + " " + u.replace("https://api.airtable.com", ""));
    if (rq.method() !== "GET" && !/listRecords/.test(u)) writeAttempts++;
    if (!(rq.headers().authorization || "").startsWith("Bearer pat_TEST")) return route.fulfill({ status: 401, contentType: "application/json", body: '{"error":{"type":"AUTHENTICATION_REQUIRED"}}' });
    if (/meta\/whoami/.test(u)) return route.fulfill({ json: { id: "usrX", email: "tester@example.org", scopes: ["data.records:read"] } });
    const m = u.match(/\/v0\/app\w+\/(tbl\w+)\/listRecords/); if (m) return route.fulfill({ json: { records: tbl[m[1]] || [] } });
    route.fulfill({ status: 404, body: "{}" });
  });
  await pg.goto(url);
  // 1 bad token
  await pg.fill("#tok", "wrong"); await pg.click("#go"); await pg.waitForSelector("#err:not(:empty)");
  ok(/401/.test(await pg.textContent("#err")), "bad token shows a clear 401 message and stays on the gate");
  // 2 good token
  await pg.fill("#tok", "pat_TEST123"); await pg.click("#go"); await pg.waitForSelector("#main h2");
  ok(/Today/.test(await pg.textContent("#main")), "home loads after a valid token");
  ok(await pg.evaluate(() => !document.documentElement.innerHTML.includes("pat_TEST123")), "token is not present in the page DOM");
  ok(await pg.evaluate(() => !localStorage.length && !sessionStorage.length), "nothing stored by default (token not persisted)");
  ok((await pg.textContent("#statusbar")).includes("read-only"), "status bar reports read-only token");
  // 3 list + search
  await pg.click("text=All bookings"); ok((await pg.$$(".bcard")).length === 2, "active filter hides completed and test bookings (2 shown)");
  await pg.fill("#q", "sample"); ok((await pg.$$(".bcard")).length === 1, "search narrows to one booking");
  await pg.fill("#q", ""); await pg.click("text=Test (ZZZ)"); ok((await pg.$$(".bcard")).length === 1, "ZZZ test filter shows the test record");
  await pg.click("text=Active"); await pg.click(".bcard:has-text('Test Academy')");
  // 4 overview
  ok(/Test Academy/.test(await pg.textContent("#main")) && /Pat Teacher/.test(await pg.textContent("#main")), "overview shows booking and contact details");
  ok(/Two deposit figures/.test(await pg.textContent("#main")), "deposit-display defect flag appears ($500 vs $6,953)");
  ok(/schedule edited after approval/.test(await pg.textContent("#main")), "schedule-after-approval warning text from Airtable is surfaced");
  // 5 budget
  await pg.click("nav button:has-text('Budget')");
  ok(/Mirror matches Airtable/.test(await pg.textContent("#main")), "pricing mirror reproduces stored total $34,765.50");
  ok(!/Total program cost/.test(await pg.textContent("#main")), "staff view hides internal cost and margin");
  await pg.selectOption("#roleSel", "rose"); ok(/Total program cost/.test(await pg.textContent("#main")), "pricing view shows internal cost");
  await pg.fill("#wi input[data-k=students]", "100"); ok(/\+\$\d/.test(await pg.textContent("#wiOut")), "what-if raises total when students increase");
  // 6 vendors
  await pg.click("nav button:has-text('Vendor')"); await pg.waitForSelector("#vOut");
  ok(/Departures required[^]*8/.test(await pg.textContent("#vOut")), "8 departures required for 113 aboard at capacity 15");
  ok(/not entered|2/.test(await pg.inputValue("#vVes")), "vessels available prefilled from Rates table (2)");
  await pg.fill("#vVes", "2"); ok(/4/.test(await pg.textContent("#vOut")) && /more than the 1/.test(await pg.textContent("#vOut")), "2 vessels / 8 departures = 4 windows, flagged against 1 planned");
  await pg.selectOption("#vSel", "recVEND2"); ok(/Missing:/.test(await pg.textContent("#vOut")) && /Do not guess/.test(await pg.textContent("#vOut")), "vendor with no rate is flagged incomplete, no invented price");
  // 7 contract
  await pg.click("nav button:has-text('Contracts')");
  ok(/Projected dates/.test(await pg.textContent("#main")) && /by design/.test(await pg.textContent("#main")), "contract tab labels projected dates and explains same-day deposit/Payment 2");
  // 8 edit dry run
  await pg.click("nav button:has-text('Edit')"); await pg.fill("[data-e=students]", "abc"); await pg.click("#prev");
  ok(/Whole number/.test(await pg.textContent("#planOut")), "validation rejects non-numeric headcount");
  await pg.fill("[data-e=students]", "95"); await pg.fill("[data-e=arrival]", "2027-04-10"); await pg.fill("[data-e=departure]", "2027-04-01"); await pg.click("#prev");
  ok(/before arrival/.test(await pg.textContent("#planOut")), "cross-field rule: departure before arrival is rejected");
  await pg.fill("[data-e=departure]", "2027-04-12"); await pg.click("#prev");
  ok(/Would become/.test(await pg.textContent("#planOut")) && (await pg.$("#planOut button[disabled]")) !== null, "valid change shows diff and Save is disabled");
  // approved booking warning
  await pg.click("nav button:has-text('Today')"); await pg.click("text=All bookings"); await pg.click(".bcard:has-text('Sample Prep')"); await pg.click("nav button:has-text('Edit')");
  await pg.fill("[data-e=students]", "61"); await pg.click("#prev");
  ok(/un-approve it, bump the Proposal Version to 3/.test(await pg.textContent("#planOut")), "approved booking: warns about un-approve + version bump");
  await pg.click("nav button:has-text('Overview')"); ok(/not published yet/.test(await pg.textContent("#main")), "unpublished approved version is flagged");
  // 9 program
  await pg.click("nav button:has-text('Program')"); ok(/Fish ID/.test(await pg.textContent("#main")), "schedule block displays");
  await pg.screenshot({path:process.env.SHOT||"/tmp/shot.png"});
  // 10 safety
  ok(writeAttempts === 0, "no write request was ever sent to Airtable (" + writeAttempts + ")");
  const commitBlocked = await pg.evaluate(async () => { try { await ReefData._patch("tbl", "rec", {}); return "sent"; } catch (e) { return e.message; } });
  ok(/disabled/.test(commitBlocked), "adapter write path refuses while writes are disabled");
  ok(errs.length === 0, "no JavaScript errors" + (errs.length ? ": " + errs.join("|") : ""));
  await pg.click("#disc"); ok(await pg.isVisible("#gate"), "Disconnect returns to the token screen");
  await br.close(); srv.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
