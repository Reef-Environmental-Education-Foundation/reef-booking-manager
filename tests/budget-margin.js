/* Budget & Margin panel test. Serves the app, mocks api.airtable.com with SYNTHETIC data (no real school or figures), drives the UI.
   Run: node tests/budget-margin.js   (needs playwright). */
const { chromium } = require("playwright"); const http = require("http"), fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, ".."); const win = {}; vm.runInNewContext(fs.readFileSync(path.join(root, "js/config.js"), "utf8"), { window: win });
const C = win.REEF_CONFIG, f = C.F, T = C.T;
const mk = (id, o) => ({ id, createdTime: "2026-01-01T00:00:00.000Z", fields: o });
/* Two sibling options for one school. Numbers are invented but internally consistent with Airtable's formulas:
   revenue = total - tax; subtotal = fees + passthrough; totalCost = hard + staff + campus; margin = revenue - totalCost. */
const base = { [f.org]: "Test Academy", [f.status]: "Proposal Sent", [f.type]: "Expedition", [f.students]: 18, [f.chaps]: 2, [f.teamTotal]: 2, [f.freeChap]: 2, [f.tax]: 0,
  [f.campusFee]: 420, [f.supplies]: 630, [f.manualVendorEst]: 4100, [f.addVendor]: 590, [f.pennTotal]: 32, [f.pennVehicles]: 4, [f.gratTotal]: 440, [f.directExp]: 5162,
  [f.sessions]: 3, [f.boatTrips]: 2, [f.aboard]: 22, [f.activities]: ["recACT1", "recACT2"], [f.internalNotes]: "Some note\nPRICING: vendor $4,100 (2 boats x 2 trips x $900 + gear) + additional $590\nSTAFFING PLACEHOLDER: 2 staff",
  [f.staffLabor]: 2625, [f.campusCost]: 420, [f.staffHours]: 75, [f.deliveryHrs]: 30, [f.campusHours]: 12, [f.vendorAuto]: 0, [f.materialsActual]: 0, [f.mileage]: 0 };
const A = mk("recAAAAAAAAAAAAA1", Object.assign({}, base, { [f.name]: "Test Academy - Jan 29 to Feb 1, 2027 - 4-Day", [f.arrival]: "2027-01-29", [f.departure]: "2027-02-01",
  [f.progFees]: 4680, [f.fullDays]: 2, [f.arrDepDays]: 2, [f.subtotal]: 10892, [f.uplift]: 544.6, [f.total]: 11436.6, [f.revenue]: 11436.6, [f.totalCost]: 8207, [f.margin]: 3229.6, [f.marginPct]: 28.2 }));
const B = mk("recAAAAAAAAAAAAA2", Object.assign({}, base, { [f.name]: "Test Academy - Jan 29 to 31, 2027 - 3-Day", [f.arrival]: "2027-01-29", [f.departure]: "2027-01-31",
  [f.progFees]: 4320, [f.fullDays]: 3, [f.arrDepDays]: 0, [f.subtotal]: 10532, [f.uplift]: 526.6, [f.total]: 11058.6, [f.revenue]: 11058.6, [f.totalCost]: 8207, [f.margin]: 2851.6, [f.marginPct]: 25.8 }));
const OTHER = mk("recAAAAAAAAAAAAA3", Object.assign({}, base, { [f.name]: "Other School - Mar 2, 2027 - 2-Day", [f.org]: "Other School", [f.arrival]: "2027-03-02", [f.departure]: "2027-03-03",
  [f.progFees]: 3000, [f.subtotal]: 8000, [f.uplift]: 400, [f.total]: 8400, [f.revenue]: 8400, [f.totalCost]: 8207, [f.margin]: 193, [f.marginPct]: 2.3 }));
const BAD = mk("recAAAAAAAAAAAAA4", Object.assign({}, base, { [f.name]: "Broken Math - Apr 1, 2027", [f.org]: "Broken Math", [f.arrival]: "2027-04-01", [f.departure]: "2027-04-02",
  [f.progFees]: 3000, [f.subtotal]: 8000, [f.uplift]: 400, [f.total]: 8400, [f.revenue]: 8400, [f.totalCost]: 8207, [f.margin]: 999, [f.marginPct]: 11.9, [f.teamTotal]: 0 }));
const tbl = {}; Object.keys(T).forEach(k => tbl[T[k]] = []); tbl[T.bookings] = [A, B, OTHER, BAD];
tbl[T.activities] = [mk("recACT1", { fldkS3bfc5eMBvXW6: "Boat Snorkel" }), mk("recACT2", { fldkS3bfc5eMBvXW6: "Kayaking at Pennekamp (Mangrove Tour)" })];
const rk = { reef_program_fee_full_day: 80, reef_program_fee_arr_dep_day: 50, reef_supplies_per_participant: 35, reef_campus_facility_half_day: 140, policy_uplift_pct: 0.05, oceanfirst_boat_halfday: 900, oceanfirst_boat_snorkel_cap: 15, oceanfirst_boats_available: 2, oceanfirst_snorkel_gear: 25, oceanfirst_boat_gratuity: 10, reef_double_kayak: 50, reef_single_kayak: 45, paddle_double_kayak: 62, paddle_staff_kayak: 45, pennekamp_entrance: 8, pennekamp_pax_per_vehicle: 6, policy_default_staff_kayaks: 2, pennekamp_entrance_bus: 60, policy_free_chap_threshold: 10 };
Object.keys(rk).forEach((k, i) => tbl[T.rates].push(mk("recRK" + i, { fldRYBqehbV1cckD9: k, fldgwo9ZQv09nEFhr: rk[k] })));
let writes = 0, pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + m); };
const srv = http.createServer((q, r) => { const p = path.join(root, q.url === "/" ? "index.html" : q.url.split("?")[0]); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "Content-Type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : "text/html" }); r.end(d); } }); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const url = "http://localhost:" + srv.address().port + "/";
  const br = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}); const pg = await br.newPage({ viewport: { width: 1280, height: 1100 } }); const errs = []; pg.on("pageerror", e => errs.push(e.message));
  await pg.route("https://api.airtable.com/**", async route => { const rq = route.request(), u = rq.url();
    if (rq.method() !== "GET" && !/listRecords/.test(u)) writes++;
    if (/meta\/whoami/.test(u)) return route.fulfill({ json: { id: "usrX", email: "tester@example.org", scopes: ["data.records:read"] } });
    const m = u.match(/\/v0\/app\w+\/(tbl\w+)\/listRecords/); if (m) return route.fulfill({ json: { records: tbl[m[1]] || [] } });
    route.fulfill({ status: 404, body: "{}" }); });
  await pg.goto(url); await pg.fill("#tok", "pat_TEST123"); await pg.click("#go"); await pg.waitForSelector("#main h2");
  await pg.click("text=All bookings"); await pg.click(".bcard:has-text('Test Academy') >> nth=0");
  await pg.click("nav button:has-text('Budget & Margin')");
  ok(/Switch the View menu/.test(await pg.textContent("#main")) && !/Net margin/.test(await pg.textContent("#main")), "Staff view: panel is hidden behind the Pricing & costs view prompt");
  await pg.selectOption("#roleSel", "rose");
  const main = async () => (await pg.textContent("#main")).replace(/\s+/g, " ");
  let t = await main();
  ok(/Net margin \$/.test(t) && /\$3,230/.test(t) && /\$2,852/.test(t), "Pricing view: both sibling options show net margin dollars side by side");
  ok(/28\.2%/.test(t) && /25\.8%/.test(t), "both margin percents shown (28.2% and 25.8%)");
  ok(/4-day/.test(t) && /3-day/.test(t) && /Difference/.test(t), "columns labeled 4-day and 3-day, with a Difference column");
  ok(/Boat, gear/.test(t) === false && /Vendor estimate \(manual/.test(t) && /Crew gratuities/.test(t) && /Pennekamp/.test(t), "hard cost lines listed; zero-everywhere lines (auto vendors, mileage) are omitted");
  ok(/Staff labor hours.*75 hrs/.test(t) && /Total program cost/.test(t), "staff labor hours shown");
  ok(/18 paid × 2 days × \$80/.test(t) && /\$2,880/.test(t) && /18 paid × 2 days × \$50/.test(t) && /\$1,800/.test(t), "program fee itemized: full days and arrival/departure days (4-day)");
  ok(/18 paid × 3 days × \$80/.test(t) && /\$4,320/.test(t), "3-day column shows 3 full days x $80");
  ok(/2 boats × 2 trips = 4 departures × \$900/.test(t) && /\$3,600/.test(t) && /20 people × \$25/.test(t), "vendor estimate itemized into boat charters and snorkel gear");
  ok(/10 doubles × \$50/.test(t) && /2 × \$45/.test(t), "additional vendor costs itemized into guided double kayaks and staff kayaks");
  ok(/22 aboard × 2 trips × \$10/.test(t) && /4 vehicles × \$8/.test(t), "gratuities and Pennekamp show quantity x rate");
  ok(/2 staff × 30 hrs × 1\.25 prep/.test(t) && /75 hrs × \$35/.test(t) && /12 campus hrs × \$35/.test(t) && /2 full × 10 \+ 2 arrival\/departure × 5/.test(t), "staff and campus cost formulas shown");
  ok(/notes on file/.test(t) && /PRICING: vendor \$4,100/.test(t), "Airtable's PRICING note is shown from Internal notes");
  ok(/Checks pass/.test(t), "reconciliation checks pass on consistent data");
  await pg.click("nav button:has-text('Budget & Pricing')"); const tp = await main();
  ok(!/Mirror out of date/.test(tp) && /\$11,437/.test(tp), "Budget & Pricing: activities resolve to names, so the price mirror matches Airtable (no 'Mirror out of date' warning)");
  ok(/Revenue less direct expenses/.test(tp) && /\$6,275/.test(tp) && !/Net income/.test(tp), "Internal cost card shows revenue less direct expenses ($6,275), not the legacy Net Income field");
  await pg.click("nav button:has-text('Budget & Margin')"); t = await main();
  const diff = await pg.$$eval("tr.net td.dlt", e => e.map(x => x.textContent.trim()));
  ok(diff[0] === "−$378" && /2\.5 pts/.test(diff[1]), "difference column: 3-day minus 4-day margin = −$378 and −2.5 pts (got " + diff.join(" | ") + ")");
  ok(!/Other School/.test(t.split("Compare with")[1].split("Sibling options only")[0] || ""), "unrelated school is not auto-added as a sibling");
  await pg.selectOption(".bm select", "recAAAAAAAAAAAAA3"); t = await main();
  ok(/Other School|2-day/.test(t) && !/Difference/.test(t), "Compare with adds a third column (no pairwise Difference column)");
  await pg.screenshot({ path: process.env.SHOT || "/tmp/bm.png", fullPage: true });
  await pg.selectOption(".bm select", ""); await pg.click("nav button:has-text('All bookings')"); await pg.click(".bcard:has-text('Broken Math')"); await pg.click("nav button:has-text('Budget & Margin')"); t = await main();
  ok(/No staffing entered/.test(t) && /Program Margin \$ is \$999/.test(t) && /Check the warnings/.test(t), "inconsistent data raises visible warnings (no staffing, margin mismatch)");
  ok(writes === 0, "no write request sent to Airtable");
  ok(errs.length === 0, "no JavaScript errors" + (errs.length ? ": " + errs.join("|") : ""));
  await br.close(); srv.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
