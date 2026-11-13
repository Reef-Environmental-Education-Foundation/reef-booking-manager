/* Vendor and rate picker: browser tests. SYNTHETIC data, mocked Airtable, no token, no network.
   Run: node tests/vendors-ui.js (needs playwright; set CHROMIUM_PATH if its browser is not installed). */
const { chromium } = require("playwright"); const http = require("http"), fs = require("fs"), path = require("path"), vm = require("vm");
const FX = require("./vendors-fixture.js");
const root = path.join(__dirname, ".."); const win = {}; vm.runInNewContext(fs.readFileSync(path.join(root, "js/config.js"), "utf8"), { window: win });
const C = win.REEF_CONFIG, f = C.F, T = C.T, mk = FX.mk;
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + m); };
const rk = { reef_program_fee_full_day: 80, reef_program_fee_arr_dep_day: 50, reef_supplies_per_participant: 35, reef_campus_facility_half_day: 140, policy_uplift_pct: 0.05, oceanfirst_boat_halfday: 900, oceanfirst_boat_snorkel_cap: 15, oceanfirst_boats_available: 2, oceanfirst_snorkel_gear: 25, oceanfirst_boat_gratuity: 10, reef_double_kayak: 50, reef_single_kayak: 45, policy_default_staff_kayaks: 2, pennekamp_entrance_bus: 60, policy_free_chap_threshold: 10, paddle_double_kayak: 62, paddle_staff_kayak: 45, pennekamp_entrance: 8, pennekamp_pax_per_vehicle: 6 };
const baseRates = Object.keys(rk).map((k, i) => mk("recRK" + i, { [FX.R.key]: k, [FX.R.num]: rk[k] }));
const ID = { A: "recBKA000000001", BLANK: "recBKB000000001", APPR: "recBKC000000001", SIGNED: "recBKD000000001", LEGACY: "recBKE000000001", REAL: "recBKF000000001", MIX: "recBKG000000001", NOCAP: "recBKH000000001" };
const base = o => Object.assign({ [f.status]: "Quoting", [f.arrival]: "2027-05-01", [f.departure]: "2027-05-02", [f.students]: 20, [f.chaps]: 5, [f.boatTrips]: 2, [f.activities]: ["recACTS"], [f.approved]: false, [f.propVer]: 1, [f.total]: 10000, [f.vendorAuto]: 1800, [f.modified]: "2026-11-02T00:00:00.000Z", [f.agreementStatus]: "Not Sent" }, o);
const bookings = [
  mk(ID.A, base({ [f.name]: "ZZZ Picker A", [f.org]: "ZZZ Test", [f.pricingRates]: ["recR8", "recR10", "recR9"] })),
  mk(ID.BLANK, base({ [f.name]: "ZZZ Blank", [f.org]: "ZZZ Test", [f.vendorMissing]: "Missing: boat snorkel rate", [f.vendorAuto]: undefined })),
  mk(ID.APPR, base({ [f.name]: "ZZZ Approved", [f.org]: "ZZZ Test", [f.approved]: true, [f.approvedVer]: 1, [f.pricingRates]: ["recR8"] })),
  mk(ID.SIGNED, base({ [f.name]: "ZZZ Signed", [f.org]: "ZZZ Test", [f.agreementStatus]: "Signed", [f.pricingRates]: ["recR8"] })),
  mk(ID.LEGACY, base({ [f.name]: "ZZZ Legacy", [f.org]: "ZZZ Test", [f.pricingModel]: "Legacy (completed)", [f.pricingRates]: ["recR8"] })),
  mk(ID.REAL, base({ [f.name]: "Synthetic Real School - 2027", [f.org]: "Synthetic Real School", [f.pricingRates]: ["recR8"] })),
  mk(ID.MIX, base({ [f.name]: "ZZZ Mixed", [f.org]: "ZZZ Test", [f.activities]: ["recACTS", "recACTD"], [f.pricingRates]: ["recR12", "recR13"], [f.students]: 40, [f.chaps]: 6 })),
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
  // ==== END OF STAGES ====
  await br.close(); srv.close(); srvOpen.close(); srvOff.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
