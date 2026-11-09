/* Local test: serves the app, mocks api.airtable.com with SYNTHETIC data, drives the UI with Playwright.
   Run: node tests/run.js   (needs playwright). No real token or data is used. */
const { chromium } = require("playwright"); const http = require("http"), fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, ".."); const win = {}; vm.runInNewContext(fs.readFileSync(path.join(root, "js/config.js"), "utf8"), { window: win }); const C = win.REEF_CONFIG, f = C.F;
const mk = (id, o) => ({ id, createdTime: "2026-01-01T00:00:00.000Z", fields: o });
const bookings = [
  mk("recAAAAAAAAAAAAA1", { [f.name]: "Test Academy - Apr 15 to 16, 2027 - 2-Day Expedition", [f.org]: "Test Academy", [f.status]: "Quoting", [f.type]: "Expedition", [f.location]: "Key Largo", [f.arrival]: "2027-04-15", [f.departure]: "2027-04-16", [f.students]: 90, [f.chaps]: 14, [f.teamTotal]: 9, [f.aboard]: 113, [f.fullDays]: 2, [f.arrDepDays]: 0, [f.sessions]: 7, [f.boatTrips]: 1, [f.buses]: 3, [f.activities]: "Boat Snorkel, Pennekamp", [f.total]: 31941, [f.vendorAuto]: 12490, [f.pennTotal]: 180, [f.gratTotal]: 1130, [f.totalCost]: 21080, [f.margin]: 13685.5, [f.marginPct]: 39.4, [f.priorSigned]: 24510, [f.pricingModel]: "Per-participant (Expedition / other)", [f.tier]: 2, [f.depositAmt]: 6953.1, [f.depositDue]: "2026-11-17", [f.pay2Amt]: 10429.65, [f.pay2Due]: "2026-11-17", [f.depositNow]: 500, [f.lockDate]: "2027-01-15", [f.rosterDue]: "2027-03-16", [f.check]: "• No schedule rows\n• Agreement Date blank", [f.acceptance]: "Not accepted", [f.propVer]: 3, [f.approved]: false, [f.contact]: "Pat Teacher", [f.email]: "pat@example.org", [f.modified]: "2026-11-01T10:00:00.000Z", [f.freeChap]: 10, [f.schedChanged]: "WARNING: schedule edited after approval. Bump Proposal Version and re-approve.", [f.nextAction]: "Send vendor request", [f.followUp]: "2026-10-01" }),
  mk("recAAAAAAAAAAAAA2", { [f.name]: "Sample Prep - Mar 17, 2027 - 1-Day", [f.org]: "Sample Prep", [f.status]: "Proposal Sent", [f.arrival]: "2027-03-17", [f.students]: 60, [f.chaps]: 8, [f.total]: 9000, [f.approved]: true, [f.approvedVer]: 2, [f.propVer]: 2, [f.publishedVer]: 1, [f.depositNow]: 500, [f.depositAmt]: 1800, [f.epoId]: "recEPO1", [f.modified]: "2026-11-01T10:00:00.000Z" }),
  mk("recAAAAAAAAAAAAA3", { [f.name]: "ZZZ Test Booking A", [f.org]: "ZZZ Test", [f.status]: "Quoting", [f.arrival]: "2027-06-01", [f.students]: 20, [f.chaps]: 3, [f.total]: 1000, [f.approved]: false, [f.propVer]: 1, [f.modified]: "2026-11-02T00:00:00.000Z" }),
  mk("recAAAAAAAAAAAAA4", { [f.name]: "Old Group 2026", [f.org]: "Old Group", [f.status]: "Completed", [f.arrival]: "2026-03-01", [f.students]: 40, [f.total]: 5000 })];
const BEN = "recAAAAAAAAAAAAA5";
bookings.push(mk(BEN, { [f.name]: "Synthetic Reef School - Mar 2027", [f.org]: "Synthetic Reef School", [f.status]: "Proposal Sent", [f.type]: "Expedition", [f.arrival]: "2027-03-10", [f.departure]: "2027-03-12", [f.students]: 90, [f.chaps]: 10, [f.aboard]: 109, [f.teamTotal]: 9, [f.fullDays]: 2, [f.arrDepDays]: 0, [f.sessions]: 4, [f.boatTrips]: 0, [f.buses]: 3, [f.activities]: "Boat Snorkel, Pennekamp", [f.progFees]: 14400, [f.supplies]: 3150, [f.campusFee]: 560, [f.pennTotal]: 180, [f.vendorAuto]: 0, [f.manualVendorEst]: 6982, [f.gratTotal]: 1090, [f.addVendor]: 870, [f.subtotal]: 27232, [f.uplift]: 1361.6, [f.total]: 28593.6, [f.pricingModel]: "Per-participant (Expedition / other)", [f.freeChap]: 10, [f.tier]: 2, [f.depositAmt]: 5718.72, [f.depositDue]: "2026-12-01", [f.pay2Amt]: 8578.08, [f.pay2Due]: "2026-12-01", [f.finalAmt]: 14046.8, [f.finalDue]: "2027-02-10", [f.depositNow]: 500, [f.cohorts]: 3, [f.check]: "• Agreement Date blank\n• Vendor quote not confirmed", [f.approved]: false, [f.propVer]: 1, [f.modified]: "2026-11-01T10:00:00.000Z" }));
Object.assign(bookings.find(b => b.id === BEN).fields, { [f.mealCount]: 3, [f.mealReview]: 1, [f.mealDeadline]: "2027-02-20", [f.mealOpen]: "TEST lunch: confirm headcount\nTEST dinner: vendor reply",
  [f.lodgeCode]: "TESTCODE-77", [f.lodgeReleased]: "2026-12-01", [f.lodgeUsedCode]: true, [f.mealVendorCost]: 777.25, [f.mealMargin]: 222.75, [f.combinedMargin]: 5555.5 });
const T = C.T, tbl = {}; Object.keys(T).forEach(k => tbl[T[k]] = []); tbl[T.bookings] = bookings;
tbl[T.vendors] = [mk("recVEND1", { fldJXlYdLLboDvdDU: "Sample Boat Co", fldaWx0fSdL6deDWg: ["Boat charter"], fldoONPWl4JtotDzS: "Active", fldUdAUH5A6EJnu4O: ["recRATE1"] }), mk("recVEND2", { fldJXlYdLLboDvdDU: "Placeholder Dives", fldaWx0fSdL6deDWg: ["Boat charter"], fldoONPWl4JtotDzS: "Needs Follow-Up" })];
tbl[T.rates] = [mk("recRATE1", { fldadLk6n35nhrTv3: "Half-day charter", fldNcPkwaDQiOkJ1n: ["recVEND1"], fldoteimNwlYE0l6g: 900, fldcZViXxZuaWm791: "Confirmed", fldcOWfy9rUIpSQy9: "Available" })];
const rk = { reef_program_fee_full_day: 80, reef_program_fee_arr_dep_day: 50, reef_supplies_per_participant: 35, reef_campus_facility_half_day: 140, policy_uplift_pct: 0.05, oceanfirst_boat_halfday: 900, oceanfirst_boat_snorkel_cap: 15, oceanfirst_boats_available: 2, oceanfirst_snorkel_gear: 25, oceanfirst_boat_gratuity: 10, reef_double_kayak: 50, reef_single_kayak: 45, policy_default_staff_kayaks: 2, pennekamp_entrance_bus: 60, policy_free_chap_threshold: 10 };
Object.keys(rk).forEach((k, i) => tbl[T.rates].push(mk("recRK" + i, { fldRYBqehbV1cckD9: k, fldgwo9ZQv09nEFhr: rk[k] })));
tbl[T.schedule] = [mk("recS1", { fld3IFyuSMhEhIk3j: ["recAAAAAAAAAAAAA2"], fldD5F2jqNh98G059: 1, fldyF4IOUHnjLBOhe: "A", fld6ZXXwtnyVQXiJz: "09:00", flduffPfhDSfUpoRs: "10:00", fldA1uxhbnsdlnM53: "Fish ID", fldBdQbcgMPNih7dn: "OK" })];
const sc = (id, day, coh, st, en, nm) => mk(id, { fld3IFyuSMhEhIk3j: [BEN], fldD5F2jqNh98G059: day, fldyF4IOUHnjLBOhe: coh, fld6ZXXwtnyVQXiJz: st, flduffPfhDSfUpoRs: en, fldA1uxhbnsdlnM53: nm, fldBdQbcgMPNih7dn: "OK" });
tbl[T.schedule].push(sc("recB1", 1, "A", "15:00", "17:30", "Reef Lab A"), sc("recB2", 1, "B", "15:00", "17:30", "Reef Lab B"), sc("recB3", 1, "C", "15:00", "17:30", "Reef Lab C"), sc("recB4", 1, "All", "19:30", "20:30", "Night Activity"), sc("recB5", 1, "All", "18:00", "19:00", "Dinner"), sc("recB6", 2, "All", "07:30", "08:30", "Breakfast"), sc("recB7", 2, "All", "18:15", null, "Departure"));
tbl[T.rates].push(mk("recMOTE", { fldRYBqehbV1cckD9: "mote_activity_fee", fldadLk6n35nhrTv3: "MOTE Coral Nursery activity", fldgwo9ZQv09nEFhr: 150, fldzag1pINQmNbX9S: "$/group/session" }));
tbl[T.comms] = [mk("recC1", { fld0yV06EMb364wDo: ["recAAAAAAAAAAAAA1"], fldyfBpgjI99tPxqR: "Sent proposal", fldqOd7K3DlVNYYAG: "2026-10-20" })];
tbl[T.checklist] = [mk("recK1", { fldl9U7R5wd51QTCQ: ["recAAAAAAAAAAAAA1"], fld0QmKxGP1qn0S1C: "Roster", fldyIZDGmyfULPD8x: true })];
tbl["tbluKC2sTvtaypK7W"] = [mk("recV1", { fld9shgPkcovzaeqY: ["recAAAAAAAAAAAAA2"], fldo9lLqOFJTBtgUt: 1, fldoYWMVJkbBK1dFd: 8500, fldxWZsJpLZHTyMCI: 60, fldUBjgPZLoTjDglV: "2027-03-17", fldkBodBHe3GJHsf5: "2026-10-01T12:00:00.000Z" })];
const log = []; let writeAttempts = 0;
const srv = http.createServer((q, r) => { const p = path.join(root, q.url === "/" ? "index.html" : q.url.split("?")[0]); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "Content-Type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : "text/html" }); r.end(d); } }); });
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + m); };
(async () => {
  await new Promise(r => srv.listen(0, r)); const url = "http://localhost:" + srv.address().port + "/";
  const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
  await pg.addInitScript(() => { window.REEF_REFRESH_MS = 1500; }); const errs = []; pg.on("pageerror", e => errs.push(e.message));
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
  await pg.click("text=All bookings"); ok((await pg.$$(".bcard")).length === 3, "active filter hides completed and test bookings (3 shown)");
  await pg.fill("#q", "sample"); ok((await pg.$$(".bcard")).length === 1, "search narrows to one booking");
  await pg.fill("#q", ""); await pg.click("text=Test (ZZZ)"); ok((await pg.$$(".bcard")).length === 1, "ZZZ test filter shows the test record");
  await pg.click("text=Active"); await pg.click(".bcard:has-text('Test Academy')");
  // 4 overview
  ok(/Test Academy/.test(await pg.textContent("#main")) && /Pat Teacher/.test(await pg.textContent("#main")), "overview shows booking and contact details");
  ok(!/Two deposit figures|defect/i.test(await pg.textContent("#main")), "D7: red deposit-defect warning is gone from the overview");
  ok(/schedule edited after approval/.test(await pg.textContent("#main")), "schedule-after-approval warning text from Airtable is surfaced");
  // 5 budget
  await pg.click("nav button:has-text('Budget')");
  ok(/Mirror matches Airtable/.test(await pg.textContent("#main")), "pricing mirror reproduces stored total $31,941 using Airtable's own formulas");
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
  await pg.click("nav button:has-text('Contracts')"); ok(/Published versions/.test(await pg.textContent("#main")) && /v1/.test(await pg.textContent("#main")), "contracts tab lists published versions from the Proposal Versions table");
  await pg.click("nav button:has-text('Edit')"); ok(/Start a new draft/.test(await pg.textContent("#main")), "approved booking shows the start-new-draft explanation");
  await pg.click("nav button:has-text('Vendor')"); ok(/No vendor lines recorded/.test(await pg.textContent("#main")), "vendor tab shows empty vendor-lines state");
  // 9 program
  await pg.click("nav button:has-text('Program')"); ok(/Fish ID/.test(await pg.textContent("#main")), "schedule block displays");
  await pg.screenshot({path:process.env.SHOT||"/tmp/shot.png"});
  // ===== v0.4 first-live-test fixes =====
  await pg.click("nav button:has-text('Today')"); await pg.click("text=All bookings"); await pg.click(".bcard:has-text('Synthetic Reef School')");
  await pg.click("nav button:has-text('Budget')"); let mn = await pg.textContent("#main");
  ok(/Vendors, incl\. crew gratuities and additional vendor costs\s*\$8,942/.test(mn), "D1: one Vendors line = manual 6,982 + gratuities 1,090 + additional 870 = $8,942");
  ok(!/Gratuities|Additional vendor costs \(manual\)|Boat, gear/.test(await pg.textContent("table")), "D1: no separate gratuities / auto-vendor lines in the price table");
  ok(/Lines add up to the subtotal \(\$27,232\.00\)/.test(await pg.textContent("#reconcile")), "D1: visible reconcile check passes, lines = subtotal $27,232");
  ok(/Mirror matches Airtable/.test(mn), "D2: mirror equals Airtable's stored total $28,593.60 on the manual-vendor fixture booking");
  // D2: pricing shapes, mirror vs an independent cent-based reference
  const shapes = await pg.evaluate(() => {
    const P = ReefPricing, out = [], base = { students: 60, chaps: 8, staff: 6, days: 2, arrDays: 0, sessions: 3, trips: 1, buses: 2, discountPct: 0, upliftPct: null, addVendor: 0, manualVendor: null, acts: "Boat Snorkel, Pennekamp", model: "Per-participant (Expedition / other)", status: "Quoting", arrival: "2027-04-01", type: "Expedition", freeChapOverride: null };
    const vars = [{}, { manualVendor: 5000 }, { manualVendor: 5000, addVendor: 400 }, { addVendor: 250 }, { discountPct: 0.1 }, { manualVendor: 0 }, { trips: 0 }, { trips: 2, discountPct: 0.05 }, { arrDays: 1 }, { upliftPct: 0.03 }, { students: 71, chaps: 9, freeChapOverride: 7 }, { acts: "Kayaking, Shore Snorkel" }, { acts: "Boat Snorkel, Kayaking, Pennekamp", manualVendor: 6982, addVendor: 870, trips: 0 }, { acts: "" }];
    vars.forEach(v => { const i = Object.assign({}, base, v), r = P.calc(i, {}), R = P.R, has = s => i.acts.indexOf(s) >= 0, people = i.students + i.chaps, aboard = people + i.staff, trips = i.trips > 0 ? i.trips : 1;
      const thr = i.freeChapOverride != null ? i.freeChapOverride : R.freeChapPer, paid = people - Math.min(i.chaps, Math.floor(people / thr));
      const boat = has("Boat Snorkel") ? Math.ceil(aboard / R.boatCap) * trips * R.boatRate : 0, gear = has("Boat Snorkel") || has("Shore Snorkel") ? people * R.gear : 0, kay = has("Kayaking") ? Math.ceil(people / 2) * R.kayakDouble + R.staffKayaks * R.kayakSingle : 0;
      const sub = paid * i.days * R.programFullDay + paid * i.arrDays * R.programArrDep + paid * R.supplies + i.sessions * R.campusSession + (has("Pennekamp") ? i.buses * R.busEntrance : 0) + (i.manualVendor > 0 ? i.manualVendor : boat + gear + kay) + (has("Boat Snorkel") ? aboard * trips * R.gratuity : 0) + i.addVendor;
      out.push([Math.round(r.total * 100), Math.round((sub + sub * (i.upliftPct == null ? R.uplift : i.upliftPct) - sub * i.discountPct) * 100)]); });
    const flagged = P.calc(Object.assign({}, base, { model: "Legacy (completed)" }), {}).supported === false && P.calc(Object.assign({}, base, { model: "Discovery — Off-site" }), {}).supported === false;
    return { out, flagged }; });
  ok(shapes.flagged, "D2: legacy and discovery shapes are flagged 'mirror out of date' instead of guessed");
  ok(shapes.out.length === 14 && shapes.out.every(x => x[0] === x[1]), "D2: mirror equals reference to the cent on 14 synthetic pricing shapes (manual/blank vendor, additional costs, discount, legacy, no Pennekamp)");
  await pg.click("nav button:has-text('Vendor')"); await pg.waitForSelector("#vOut"); mn = await pg.textContent("#main");
  ok(/uses the manual Estimated Vendor Cost \(\$6,982\)/.test(mn) && /relative to that estimate/.test(mn), "D3: manual vendor estimate is named and the scenario is relative to it");
  ok(/included in the Pennekamp boat fee/.test(mn) && (await pg.inputValue("#vGear")) === "0", "D3: no snorkel gear charge for Pennekamp programs");
  ok(/Scenario total \(mirror\)\s*\$28,594/.test(await pg.textContent("#vOut")), "D3: scenario total starts at the booking total, not recomputed from zero boats");
  ok(!/Vendor lines will list here|' : '/.test(mn), "D4: stray template text is gone");
  ok(/Activity rates/.test(mn) && /MOTE Coral Nursery/.test(mn) && /\$150/.test(mn) && /\$\/group\/session/.test(mn), "D4: MOTE rate listed under Activity rates when no vendor record exists");
  await pg.click("nav button:has-text('Program')"); mn = await pg.textContent("#main");
  ok(/7 blocks · 3 cohorts/.test(mn), "D6: cohort count comes from the data (3)");
  ok(/3:00 PM–5:30 PM/.test(mn) && !/15:00/.test(mn), "D6: 12-hour times with AM/PM");
  ok(/Whole group/.test(mn) && !/Cohort All/.test(mn), "D6: 'Cohort All' reads 'Whole group'");
  ok(/Departure 6:15 PM/.test(mn) && !/18:15/.test(mn), "D6: departure with no end shows 'Departure 6:15 PM'");
  ok(/Dinner[^]*Night Activity/.test(await pg.textContent(".coh")), "D6: whole-group items in time order (Dinner before Night Activity)");
  await pg.click("nav button:has-text('Contracts')"); mn = await pg.textContent("#main");
  ok(/Agreement deposit[^]*\$5,718\.72/.test(mn) && !/defect/i.test(mn), "D7: agreement deposit is primary, no defect wording");
  ok((await pg.evaluate(() => { const d = document.querySelector("#main details.why"); return !!d && !d.open && /Legacy/.test(d.textContent); })), "D7: legacy $500 sits in a collapsed legacy-field note");
  ok(/\$250\.00 less than the total/.test(await pg.textContent("#payrec")) && /legacy flat deposit/.test(await pg.textContent("#payrec")) && /not corrected here/.test(await pg.textContent("#payrec")), "D7: payments reconcile line shows the $250 gap and its cause");
  await pg.click("nav button:has-text('Communications')"); ok(/Rose logs sends here/.test(await pg.textContent("#main")), "D8: communications empty state explains itself");
  await pg.click("nav button:has-text('Get Ready')"); ok(/Get-ready checklist<\/a>|link/.test(await pg.innerHTML("#main")) && /No checklist items yet\. Add them in Airtable/.test(await pg.textContent("#main")), "D8: get-ready empty state links to Airtable");
  await pg.click("nav button:has-text('Today')"); await pg.click("#main .bcard:has-text('Synthetic Reef School') summary");
  ok(/Source: Airtable 'Check' formula field/.test(await pg.textContent("#main")), "D9: needs-attention flags expose their source");
  // D5: refresh keeps selection and token, auto-refresh updates data
  await pg.click("text=All bookings"); await pg.click(".bcard:has-text('Synthetic Reef School')"); await pg.click("nav button:has-text('Budget')");
  const t0 = await pg.textContent("#loadedAt"); ok(/^Last loaded at /.test(t0), "D5: status bar shows 'Last loaded at <time>'");
  bookings.find(b => b.id === BEN).fields[f.nextAction] = "REFRESHED-MARKER"; bookings.find(b => b.id === BEN).fields[f.name] = "Synthetic Reef School - renamed";
  await pg.waitForTimeout(1100); await pg.click("#sbRefresh"); await pg.waitForFunction(() => /renamed/.test(document.querySelector("#main h2").textContent));
  ok(/Budget/.test(await pg.textContent("nav button.on")) && /renamed/.test(await pg.textContent("#main h2")), "D5: Refresh re-reads Airtable and keeps the selected booking and tab");
  ok(await pg.evaluate(() => !localStorage.length && !sessionStorage.length && !document.documentElement.innerHTML.includes("pat_TEST123")), "D5: token still not stored anywhere after refresh");
  bookings.find(b => b.id === BEN).fields[f.name] = "Synthetic Reef School - auto"; await pg.waitForFunction(() => /auto/.test(document.querySelector("#main h2").textContent), null, { timeout: 5000 });
  ok(true, "D5: auto-refresh picked up a change without a click");
  await pg.uncheck("#autoRef"); bookings.find(b => b.id === BEN).fields[f.name] = "Synthetic Reef School - after-off"; await pg.waitForTimeout(1800);
  ok(/auto$/.test(await pg.textContent("#main h2")), "D5: toggling auto-refresh off stops re-reads"); await pg.check("#autoRef");
  // 9b meals + lodging (synthetic)
  await pg.selectOption("#roleSel", "staff"); await pg.click("nav button:has-text('Overview')"); let mm = await pg.textContent("#main");
  ok(/Meals \(not cancelled\)\s*3/.test(mm) && /1 to review/.test(mm) && /Feb 20, 2027/.test(mm) && /TEST dinner: vendor reply/.test(mm), "meals card shows count, needs-review, next order deadline and open items");
  ok(/TESTCODE-77/.test(mm) && /Dec 1, 2026/.test(mm) && /Booked using REEF code\s*Yes/.test(mm), "lodging card shows access code, released date and booked-using-code status");
  ok(/not read or shown here/.test(mm), "lodging card states reservation contacts are not shown");
  ok(!/777\.25|222\.75|5,555|Est\. vendor cost/.test(mm), "staff view hides meal vendor cost and margins");
  await pg.selectOption("#roleSel", "rose"); mm = await pg.textContent("#main");
  ok(/\$777\.25/.test(mm) && /\$222\.75/.test(mm) && /\$5,555\.50/.test(mm), "pricing view shows meal cost, meals margin and combined margin"); await pg.selectOption("#roleSel", "staff");
  await pg.evaluate(() => REEF_UI.go("list")); const bc = await pg.textContent(".bcard:has-text('Synthetic Reef')");
  ok(/Meals: 3 · 1 to review · order by Feb 20, 2027/.test(bc), "booking list card shows the meal summary");
  ok(!/Meals:/.test(await pg.textContent(".bcard:has-text('Sample Prep')")), "a booking with no meals shows no meal line in the list");
  await pg.click(".bcard:has-text('Sample Prep')"); mm = await pg.textContent("#main");
  ok(/No meals on this booking/.test(mm) && !/Needing review/.test(mm), "a booking with no meals shows a neutral meals card and nothing else");
  ok(!C.F.lodgeContact && !Object.keys(C.F).some(k => /lodg.*(contact|phone|email)/i.test(k)), "config requests no lodging reservation contact field");
  await pg.evaluate(() => REEF_UI.go("booking", "recAAAAAAAAAAAAA5", "budget"));
  // screenshots + overflow, synthetic data only
  const shots = process.env.SHOTS || "/tmp";
  for (const [w, h] of [[1280, 900], [390, 844]]) {
    await pg.setViewportSize({ width: w, height: h });
    for (const [tab, nm] of [["Budget", "budget"], ["Program", "program"]]) { await pg.click(`nav button:has-text('${tab}')`); await pg.screenshot({ path: `${shots}/after-${nm}-${w}.png`, fullPage: true });
      ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `no horizontal overflow on ${nm} at ${w}px`); }
  }
  await pg.setViewportSize({ width: 1280, height: 900 });
  // 10 safety
  ok(writeAttempts === 0, "no write request was ever sent to Airtable (" + writeAttempts + ")");
  const commitBlocked = await pg.evaluate(async () => { try { await ReefData._patch("tbl", "rec", {}); return "sent"; } catch (e) { return e.message; } });
  ok(/disabled/.test(commitBlocked), "adapter write path refuses while writes are disabled");
  ok(errs.length === 0, "no JavaScript errors" + (errs.length ? ": " + errs.join("|") : ""));
  await pg.click("#disc"); ok(await pg.isVisible("#gate"), "Disconnect returns to the token screen");
  await br.close(); srv.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
