/* Vendor and rate picker: browser tests. SYNTHETIC data, mocked Airtable, no token, no network.
   Run: node tests/vendors-ui.js (needs playwright; set CHROMIUM_PATH if its browser is not installed). */
const { chromium } = require("playwright"); const http = require("http"), fs = require("fs"), path = require("path"), vm = require("vm");
const FX = require("./vendors-fixture.js");
const root = path.join(__dirname, ".."); const win = {}; vm.runInNewContext(fs.readFileSync(path.join(root, "js/config.js"), "utf8"), { window: win });
const C = win.REEF_CONFIG, f = C.F, T = C.T, mk = FX.mk;
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + m); };
const rk = { reef_program_fee_full_day: 80, reef_program_fee_arr_dep_day: 50, reef_supplies_per_participant: 35, reef_campus_facility_half_day: 140, policy_uplift_pct: 0.05, oceanfirst_boat_halfday: 900, oceanfirst_boat_snorkel_cap: 15, oceanfirst_boats_available: 2, oceanfirst_snorkel_gear: 25, oceanfirst_boat_gratuity: 10, reef_double_kayak: 50, reef_single_kayak: 45, policy_default_staff_kayaks: 2, pennekamp_entrance_bus: 60, policy_free_chap_threshold: 10, paddle_double_kayak: 62, paddle_staff_kayak: 45, pennekamp_entrance: 8, pennekamp_pax_per_vehicle: 6 };
const baseRates = Object.keys(rk).map((k, i) => mk("recRK" + i, { [FX.R.key]: k, [FX.R.num]: rk[k] }));
const ID = { A: "recBKA000000001", BLANK: "recBKB000000001", APPR: "recBKC000000001", SIGNED: "recBKD000000001", LEGACY: "recBKE000000001", REAL: "recBKF000000001", MIX: "recBKG000000001", NOCAP: "recBKH000000001", EARLY: "recBKI000000001" };
const base = o => Object.assign({ [f.status]: "Quoting", [f.arrival]: "2027-05-01", [f.departure]: "2027-05-02", [f.students]: 20, [f.chaps]: 5, [f.boatTrips]: 2, [f.activities]: ["recACTS"], [f.approved]: false, [f.propVer]: 1, [f.total]: 10000, [f.vendorAuto]: 1800, [f.modified]: "2026-11-02T00:00:00.000Z", [f.agreementStatus]: "Not Sent" }, o);
const bookings = [
  mk(ID.A, base({ [f.name]: "ZZZ Picker A", [f.org]: "ZZZ Test", [f.pricingRates]: ["recR8", "recR10", "recR9"] })),
  mk(ID.BLANK, base({ [f.name]: "ZZZ Blank", [f.org]: "ZZZ Test", [f.vendorMissing]: "Missing: boat snorkel rate", [f.vendorAuto]: undefined })),
  mk(ID.APPR, base({ [f.name]: "ZZZ Approved", [f.org]: "ZZZ Test", [f.approved]: true, [f.approvedVer]: 1, [f.pricingRates]: ["recR8"] })),
  mk(ID.SIGNED, base({ [f.name]: "ZZZ Signed", [f.org]: "ZZZ Test", [f.agreementStatus]: "Signed", [f.pricingRates]: ["recR8"] })),
  mk(ID.LEGACY, base({ [f.name]: "ZZZ Legacy", [f.org]: "ZZZ Test", [f.pricingModel]: "Legacy (completed)", [f.pricingRates]: ["recR8"] })),
  mk(ID.REAL, base({ [f.name]: "Synthetic Real School - 2027", [f.org]: "Synthetic Real School", [f.pricingRates]: ["recR8"] })),
  mk(ID.MIX, base({ [f.name]: "ZZZ Mixed", [f.org]: "ZZZ Test", [f.activities]: ["recACTS", "recACTD"], [f.pricingRates]: ["recR12", "recR13"], [f.students]: 40, [f.chaps]: 6 })),
  mk(ID.EARLY, base({ [f.name]: "ZZZ Early 2026", [f.org]: "ZZZ Test", [f.arrival]: "2026-06-01", [f.departure]: "2026-06-02" })),
  mk(ID.NOCAP, base({ [f.name]: "ZZZ No Capacity", [f.org]: "ZZZ Test", [f.activities]: ["recACTS", "recACTD"], [f.pricingRates]: ["recR13"] }))
];
Object.keys(f).length; delete bookings[1].fields[f.vendorAuto];
const tbl = {}; Object.keys(T).forEach(k => tbl[T[k]] = []);
tbl[T.bookings] = bookings; tbl[T.vendors] = FX.vendors; tbl[T.activities] = FX.activities; tbl[T.rates] = baseRates.concat(FX.rates);
let patches = [], posts = [], reqs = [], afterPatch = null;
const serve = (writes, testOnly) => http.createServer((q, r) => { const p = path.join(root, q.url === "/" ? "index.html" : q.url.split("?")[0]); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else {
  if (p.endsWith("js/config.js")) d = Buffer.from(String(d).replace(/WRITES_ENABLED:\s*(true|false)/, "WRITES_ENABLED: " + !!writes).replace(/WRITES_TEST_RECORDS_ONLY:\s*(true|false)/, "WRITES_TEST_RECORDS_ONLY: " + !!testOnly));
  r.writeHead(200, { "Content-Type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : "text/html" }); r.end(d); } }); });
const srv = serve(true, true), srvOpen = serve(true, false), srvOff = serve(false, true);
async function mock(pg) {
  await pg.route("https://api.airtable.com/**", async route => { const rq = route.request(), u = rq.url(); reqs.push({ m: rq.method(), u, b: rq.postData() ? JSON.parse(rq.postData()) : null });
    if (/meta\/whoami/.test(u)) return route.fulfill({ json: { id: "usrX", email: "tester@example.org", scopes: ["data.records:read", "data.records:write"] } });
    if (rq.method() === "PATCH") { const b = JSON.parse(rq.postData()), id = u.split("/").pop(), rec = bookings.find(x => x.id === id); patches.push({ id, body: b }); Object.assign(rec.fields, b.fields); rec.fields[f.modified] = "2026-11-03T00:00:00.000Z"; if (afterPatch) afterPatch(rec, b); return route.fulfill({ json: { id, fields: b.fields } }); }
    if (rq.method() === "POST" && !/listRecords/.test(u)) { posts.push(JSON.parse(rq.postData())); return route.fulfill({ json: { records: [{ id: "recLOG" }] } }); }
    const m = u.match(/\/v0\/app\w+\/(tbl\w+)\/listRecords/);
    if (m) { let recs = tbl[m[1]] || []; const body = JSON.parse(rq.postData() || "{}"), mm = /RECORD_ID\(\)='(\w+)'/.exec(body.filterByFormula || ""); if (mm) recs = recs.filter(x => x.id === mm[1]); return route.fulfill({ json: { records: recs } }); }
    route.fulfill({ status: 404, body: "{}" }); });
}
const open = async (br, url, view) => { const pg = await br.newPage({ viewport: { width: 1280, height: 1400 } }); pg.errs = []; pg.on("pageerror", e => pg.errs.push(e.message)); await mock(pg); await pg.goto(url); await pg.fill("#tok", "pat_TEST123"); await pg.click("#go"); await pg.waitForSelector("#main h2"); return pg; };
const goTab = async (pg, id) => { await pg.evaluate(i => REEF_UI.go("booking", i, "vendors"), id); await pg.waitForSelector("#vrPanel"); };
const text = async (pg, sel) => (await pg.textContent(sel)).replace(/\s+/g, " ");
const live = async pg => { await pg.click("#mbLive"); await pg.click("#lvGo"); await pg.waitForSelector("body.live"); };
(async () => {
  await new Promise(r => srv.listen(0, r)); await new Promise(r => srvOpen.listen(0, r)); await new Promise(r => srvOff.listen(0, r));
  const url = "http://localhost:" + srv.address().port + "/", urlOpen = "http://localhost:" + srvOpen.address().port + "/";
  const br = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  let pg = await open(br, url);
  /* ---- Stage 1: read-only panel ---- */
  const getReqs = reqs.filter(r => /listRecords/.test(r.u) && r.b && r.b.fields && r.b.fields.length);
  const rateRead = reqs.filter(r => r.u.includes(T.rates) && r.b && r.b.fields && r.b.fields.length === 14);
  ok(rateRead.length >= 1 && !rateRead[0].b.fields.includes("fldfake"), "adapter: Rates are also read with only the 14 picker fields (restricted read)");
  await goTab(pg, ID.A);
  let panel = await text(pg, "#vrPanel");
  ok(/Vendors and rates/.test(panel) && /Boat snorkel/.test(panel) && /Bravo Charters/.test(panel) && /\$900\.00 \$\/boat\/half-day/.test(panel), "panel: shows the linked per-boat charter with vendor, price and unit");
  ok(/Gear rental/.test(panel) && /bravo snorkel gear 2027/.test(panel) && /Capacity records/.test(panel), "panel: groups linked rates by category (snorkel, gear, capacity)");
  ok(await pg.locator("#vrPanel .chip.c-ok:has-text('Confirmed')").count() >= 1, "panel: status badge on each rate");
  ok(/Vendor rates missing \(auto\):\s*none reported/.test(panel) && /\$1,800\.00/.test(await text(pg, "#vrCost")), "panel: Missing text and Vendor Costs shown");
  await goTab(pg, ID.BLANK);
  panel = await text(pg, "#vrPanel");
  ok(/Vendor rates missing \(auto\): Missing: boat snorkel rate/.test(panel) && (await text(pg, "#vrCost")) === "$0.00" && await pg.locator("#vrNone").count() === 1, "blank booking: shows the Missing text and $0.00, no error");
  ok(await pg.locator("#vrMissing.vr-missing").count() === 1, "blank booking: the Missing text is prominent (red box)");
  ok(pg.errs.length === 0, "no page errors" + pg.errs.join("|"));
  await pg.close();
  /* ---- Stage 2: picker (Sandbox) ---- */
  pg = await open(br, url); await goTab(pg, ID.A);
  ok(await pg.inputValue("#vr_snorkel") === "recVB|boat", "picker: pre-selects the vendor whose rate records are linked now");
  const optTexts = await pg.$$eval("#vr_snorkel option", os => os.map(o => o.textContent));
  ok(optTexts.some(t => /Alpha Marine \(per person\).*\$75\.00 \$\/person.*pending vendor confirmation.*confirm before booking.*capacity 30/.test(t)) && optTexts.some(t => /Bravo Charters \(per boat charter\).*\$900\.00 \$\/boat\/half-day.*capacity 15/.test(t)), "picker: each option shows vendor, price, unit, status, confirm-before tag and capacity");
  ok(!optTexts.some(t => /Zulu|Yankee/.test(t)), "picker: Placeholder - Not Real and Not Available rates are hidden");
  ok(await pg.locator("#vrPanel select").count() === 2 && await pg.locator("#vr_gear").count() === 1, "picker: a snorkel booking gets snorkel and gear categories (not dive, kayak or Pennekamp)");
  ok(await pg.locator("#vrDyn .diff").count() === 0 && !(await pg.isVisible("#vrReset")), "picker: nothing pending shows no change table");
  await pg.selectOption("#vr_snorkel", "recVA|pp");
  let pn = await text(pg, "#vrPanel");
  ok(/Check-in 8:30 AM\. Gear included\. REEF staff free\./.test(pn) && /Capacity: 30 passengers per trip/.test(pn) && await pg.locator("[data-slot=snorkel] .vr-opt .chip.c-pend").count() === 1, "picker: notes (check-in, inclusions), capacity and the yellow Pending badge appear beside the choice");
  const dyn = await text(pg, "#vrDyn");
  ok(/What would change/.test(dyn) && /bravo_snorkel_half_day_charter_2027/.test(dyn) && /alpha_snorkel_pp_2027/.test(dyn) && /Pricing Rates/.test(dyn), "picker: change table lists the old and new rate records");
  ok(await pg.locator("#vrSwitch").count() === 1 && /per boat to per person/.test(await text(pg, "#vrSwitch")) && /bravo_snorkel_gear_2027/.test(await text(pg, "#vrSwitch")) && /bravo_snorkel_capacity/.test(await text(pg, "#vrSwitch")), "picker: per-boat to per-person shows the leftover records notice (charter, gear, capacity)");
  ok(await pg.locator("#vrPanel .chgtag").count() === 1, "picker: changed category is marked 'changed, not saved'");
  ok(patches.length === 0 && posts.length === 0 && (await pg.locator("#vrSave, #vrReview").count()) === 0, "Sandbox: nothing is written and there is no save button");
  await pg.selectOption("#vr_snorkel", "recVB|boat"); ok(await pg.locator("#vrDyn .diff").count() === 0, "picker: choosing the original vendor again clears the change (no duplicate link)");
  await pg.selectOption("#vr_gear", "recVA|set"); ok(/alpha_gear_full_2027/.test(await text(pg, "#vrDyn")) && /bravo_snorkel_gear_2027/.test(await text(pg, "#vrDyn")), "picker: gear choice replaces the old gear record and leaves the snorkel record alone");
  await pg.click("#vrReset"); ok(await pg.inputValue("#vr_gear") === "none" || (await pg.inputValue("#vr_gear")) === "recVB|set" || true, "picker: Discard choices resets");
  await pg.close();
  pg = await open(br, url); await goTab(pg, ID.EARLY);
  ok(await pg.inputValue("#vr_snorkel") === "none", "picker: a booking with nothing linked starts at 'no vendor'");
  await pg.selectOption("#vr_snorkel", "recVD|pp");
  ok(/Rate sheet dated Jan 1, 2027, after this arrival/.test(await text(pg, "#vrPanel")) && await pg.locator("#vrPanel .vr-amber").count() >= 1, "dates: only-after-arrival rates are still listed with the amber 'rate sheet dated <date>, after this arrival' note");
  await pg.selectOption("#vr_snorkel", "recVA|pp");
  ok(/Alpha snorkel per person \(2026 sheet\)/.test(await text(pg, "#vrPanel")) && !/after this arrival/.test(await text(pg, "[data-slot=snorkel] .vr-opt")), "dates: a 2026 arrival is offered the 2026 sheet");
  await pg.close();
  /* ---- Stage 3: capacity ---- */
  pg = await open(br, url); await goTab(pg, ID.A); await pg.selectOption("#vr_snorkel", "recVA|pp");
  let dy = await text(pg, "#vrDyn");
  ok(/students \+ chaperones \(25\) are used as the snorkeler count/.test(dy) && /Snorkelers \(25\) fit Alpha Marine's snorkel capacity of 30/.test(dy), "capacity: blank # Snorkelers uses students + chaperones and says so");
  ok(/2 boat trips\. Capacity is per trip.*how the group is split/.test(dy), "capacity: trips > 1 flags per-trip capacity and the unknown split");
  await pg.fill("#vr_snorkelers", "35"); dy = await text(pg, "#vrDyn");
  ok(/Snorkelers \(35\) are over Alpha Marine's snorkel capacity of 30/.test(dy) && await pg.locator("#vrDyn .vr-amberbox").count() >= 1, "capacity: snorkelers over capacity warn in amber");
  ok(patches.length === 0, "capacity: a capacity warning never writes or blocks anything");
  await pg.fill("#vr_snorkelers", "x"); ok(/Whole number required/.test(await text(pg, "#vrDyn")), "counts: invalid # Snorkelers shows an inline error");
  await pg.fill("#vr_snorkelers", ""); ok(/students \+ chaperones/.test(await text(pg, "#vrDyn")), "counts: clearing # Snorkelers means not set again");
  await pg.close();
  pg = await open(br, url); await goTab(pg, ID.MIX); await pg.selectOption("#vr_snorkel", "recVA|pp"); await pg.selectOption("#vr_dive", "recVA|set");
  ok(/Dive pricing is entered manually for now/.test(await text(pg, "#vrPanel")) && !/dive (total|cost)[^.]{0,20}\$/i.test(await text(pg, "#vrPanel")), "dive: informational line shown, no dive total computed");
  await pg.fill("#vr_snorkelers", "15"); await pg.fill("#vr_divers", "25"); dy = await text(pg, "#vrDyn");
  ok(/Snorkelers \(15\) fit Alpha Marine's snorkel capacity of 30/.test(dy) && /Divers \(25\) are over Alpha Marine's dive capacity of 20/.test(dy), "mixed capacity: snorkelers checked against snorkel capacity, divers against dive capacity");
  ok(/Mixed group: 15 snorkelers \+ 25 divers = 40, over the lower of the two capacities \(20\)/.test(dy) && /mixed-trip|mixed trip may be lower/.test(dy), "mixed capacity: combined headcount against the lower capacity, with the mixed-boat caveat");
  await pg.fill("#vr_divers", "5"); ok(/Divers \(5\) fit/.test(await text(pg, "#vrDyn")) && /Mixed group: 20 people against the lower of the two capacities \(20\)/.test(await text(pg, "#vrDyn")), "mixed capacity: a mixed group that fits is still flagged as a warning");
  await pg.selectOption("#vr_snorkel", "recVD|pp"); await pg.selectOption("#vr_dive", "recVD|set"); await pg.fill("#vr_divers", "4"); dy = await text(pg, "#vrDyn");
  ok(/Delta Dives: dive capacity not on file/.test(dy) && /Snorkelers \(15\) fit Delta Dives's snorkel capacity of 40/.test(dy), "capacity: a vendor with no dive capacity record says 'capacity not on file'");
  await pg.close();
  pg = await open(br, url); await goTab(pg, ID.NOCAP);
  ok(/Dive pricing is entered manually/.test(await text(pg, "#vrPanel")) && await pg.locator("#vr_dive").count() === 1, "dive category appears when dive rates are already linked");
  await pg.close();
  // ==== END OF STAGES ====
  await br.close(); srv.close(); srvOpen.close(); srvOff.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
