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
const serve = liveCfg => http.createServer((q, r) => { const p = path.join(root, q.url === "/" ? "index.html" : q.url.split("?")[0]); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { if (liveCfg && p.endsWith("js/config.js")) d = Buffer.from(String(d).replace("WRITES_ENABLED: false", "WRITES_ENABLED: true")); r.writeHead(200, { "Content-Type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : "text/html" }); r.end(d); } }); });
const srvLive = serve(true);
const srv = http.createServer((q, r) => { const p = path.join(root, q.url === "/" ? "index.html" : q.url.split("?")[0]); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "Content-Type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : "text/html" }); r.end(d); } }); });
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + m); };

/* ======================= v0.5 Sandbox / Live: unit tests (synthetic data, fetch mocked, no browser) ======================= */
function harness(cfgOver) {
  const clock = { t: 1.8e12 }, timers = [], calls = [];
  class FD extends Date { static now() { return clock.t; } }
  const st = { email: "rose@example.org", scopes: ["data.records:read", "data.records:write"], rec: null, failPatch: false, failLog: false };
  const R = (j, status) => ({ ok: (status || 200) < 400, status: status || 200, json: async () => j });
  const ctx = { console, Date: FD, setTimeout, clearTimeout, window: {},
    setInterval: fn => { timers.push(fn); return timers.length; }, clearInterval: id => { timers[id - 1] = null; },
    fetch: async (url, init) => { init = init || {}; const body = init.body ? JSON.parse(init.body) : null, method = init.method || "GET"; calls.push({ method, url, body });
      if (/meta\/whoami/.test(url)) return R({ id: "usrX", email: st.email, scopes: st.scopes });
      if (/listRecords/.test(url)) return R({ records: st.rec ? [st.rec] : [] });
      if (method === "PATCH") return st.failPatch ? R({ error: { type: "INVALID", message: "boom" } }, 422) : R({ id: st.rec.id, fields: body.fields });
      if (method === "POST") return st.failLog ? R({ error: { type: "INVALID", message: "log boom" } }, 422) : R({ records: [{ id: "recLOG" }] });
      return R({}, 404); } };
  vm.createContext(ctx);
  for (const fl of ["config", "mode", "adapter-airtable", "edits"]) vm.runInContext(fs.readFileSync(path.join(root, "js", fl + ".js"), "utf8"), ctx);
  const w = ctx.window; if (cfgOver) Object.assign(w.REEF_CONFIG, cfgOver);
  const F = w.REEF_CONFIG.F;
  const raw = (name, extra) => Object.assign({ [F.name]: name, [F.students]: 90, [F.chaps]: 14, [F.arrival]: "2027-04-15", [F.departure]: "2027-04-16", [F.approved]: false, [F.propVer]: 3, [F.modified]: "2026-11-01T10:00:00.000Z" }, extra || {});
  const set = (name, extra) => { const r = raw(name, extra); st.rec = { id: "recZZZ0000000001", fields: Object.assign({}, r) }; return { id: st.rec.id, raw: r }; };
  const writes = () => calls.filter(c => c.method === "PATCH" || (c.method === "POST" && !/listRecords/.test(c.url)));
  const goLive = async () => { w.ReefData.setToken("pat_TEST"); await w.ReefData.verify(); return w.ReefMode.requestLive(); };
  return { w, F, st, clock, timers, calls, set, writes, goLive, tick: () => timers.forEach(t => t && t()), M: () => w.ReefMode, E: () => w.ReefEdits, D: () => w.ReefData };
}
const throwsMsg = async (fn, re) => { try { await fn(); return false; } catch (e) { return re.test(e.message); } };
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

async function unitTests() {
  const cfgText = fs.readFileSync(path.join(root, "js/config.js"), "utf8"), modeText = fs.readFileSync(path.join(root, "js/mode.js"), "utf8");
  ok(/WRITES_ENABLED:\s*false/.test(cfgText) && /WRITES_TEST_RECORDS_ONLY:\s*true/.test(cfgText), "ships with WRITES_ENABLED false and WRITES_TEST_RECORDS_ONLY true");
  ok(!/localStorage|sessionStorage/.test(modeText), "mode is never persisted (mode.js uses no browser storage)");
  ok(contrast("#ffffff", "#0b4a85") >= 4.5 && contrast("#ffffff", "#a31a12") >= 4.5, "banner colours meet WCAG AA contrast (white on blue " + contrast("#ffffff", "#0b4a85").toFixed(1) + ":1, on red " + contrast("#ffffff", "#a31a12").toFixed(1) + ":1)");
  const cssText = fs.readFileSync(path.join(root, "css/app.css"), "utf8"); ok(/#0b4a85/.test(cssText) && /#a31a12/.test(cssText), "banner colours in the stylesheet are the ones contrast-checked");
  // ---- mode ----
  let h = harness(); ok(h.M().get() === "sandbox" && !h.M().isLive(), "mode: defaults to Sandbox on load");
  h.set("ZZZ Mode"); h.w.ReefData.setToken("pat_TEST"); await h.D().verify();
  let r = h.M().requestLive(); ok(!r.ok && /not switched on yet/.test(r.reason) && h.M().get() === "sandbox", "mode: Live refused while WRITES_ENABLED is false (reason: not switched on yet)");
  h = harness({ WRITES_ENABLED: true }); h.st.scopes = ["data.records:read"]; h.set("ZZZ Mode"); h.w.ReefData.setToken("pat_TEST"); await h.D().verify();
  r = h.M().requestLive(); ok(!r.ok && /cannot write/.test(r.reason) && h.M().get() === "sandbox", "mode: Live refused when the token lacks the write scope");
  h = harness({ WRITES_ENABLED: true }); h.set("ZZZ Mode"); r = await h.goLive(); ok(r.ok && h.M().isLive(), "mode: Live allowed with writes enabled and a write token");
  const seen = []; h.M().onChange(s => seen.push(s)); const idle = h.w.REEF_CONFIG.LIVE_IDLE_MS;
  h.clock.t += idle - 90 * 1000; h.tick(); ok(h.M().isLive() && seen.length && seen[seen.length - 1].warn && seen[seen.length - 1].remainingMs <= 90 * 1000, "mode: countdown state appears in the last 2 minutes");
  h.clock.t += 91 * 1000; h.tick(); ok(!h.M().isLive() && /no activity/.test(seen[seen.length - 1].reason), "mode: idle timeout (15 min) returns to Sandbox with a reason for the toast");
  r = await h.goLive(); h.clock.t += idle - 5000; h.M().touch(); h.clock.t += 10000; h.tick(); ok(h.M().isLive(), "mode: touch() resets the idle clock");
  h.clock.t += idle; h.tick(); ok(!h.M().isLive(), "mode: ...and it still times out 15 minutes after the last touch");
  await h.goLive(); h.D().clear(); h.tick(); ok(!h.M().isLive(), "mode: clearing the token drops Live to Sandbox");
  await h.goLive(); h.st.scopes = ["data.records:read"]; await h.D().verify(); h.tick(); ok(!h.M().isLive(), "mode: losing the write scope on re-verify drops Live to Sandbox");
  // ---- Sandbox can never write ----
  h = harness({ WRITES_ENABLED: true }); let bk = h.set("ZZZ Sandbox"); h.w.ReefData.setToken("pat_TEST"); await h.D().verify();
  let pl = h.E().plan(bk, { students: "95", internalNotes: "x" }); ok(pl.ok, "sandbox: plan() works");
  const sbx = [await throwsMsg(() => h.E().commit(bk, pl, { mode: "live", confirmed: true, reason: "School emailed: 5 more", user: "a@b.c" }), /Not in Live mode/), await throwsMsg(() => h.E().commit(bk, pl, { mode: "sandbox", confirmed: true, reason: "School emailed: 5 more" }), /Not in Live mode/), await throwsMsg(() => h.D()._patch(h.w.REEF_CONFIG.T.bookings, bk.id, pl.fields), /Not in Live mode/), await throwsMsg(() => h.D()._create(h.w.REEF_CONFIG.T.comms, {}), /Not in Live mode/)];
  ok(sbx.every(Boolean) && h.writes().length === 0, "sandbox: commit, _patch and _create all refuse; zero PATCH/POST-create fetch calls even with writes enabled and a write token");
  // ---- commit gates: each throws and sends nothing ----
  const gate = async (label, re, o) => { o = o || {}; const g = harness({ WRITES_ENABLED: true, WRITES_TEST_RECORDS_ONLY: true }); const b = g.set(o.name || "ZZZ Gate"); await g.goLive();
    const p = g.E().plan(b, o.changes || { students: "95" }); if (o.setup) await o.setup(g);
    const res = await throwsMsg(() => g.E().commit(b, p, Object.assign({ mode: "live", confirmed: true, reason: "School emailed: 5 more", user: "rose@example.org" }, o.opts)), re);
    ok(res && g.writes().length === 0, "commit gate: " + label + " throws and sends no write"); };
  await gate("not in Live mode", /Not in Live mode/, { setup: g => g.M().toSandbox("t") });
  await gate("opts.mode is not live", /Not in Live mode/, { opts: { mode: "sandbox" } });
  await gate("not confirmed", /not confirmed/, { opts: { confirmed: false } });
  await gate("confirmed must be exactly true", /not confirmed/, { opts: { confirmed: "yes" } });
  await gate("reason too short", /reason of at least 10/, { opts: { reason: "too short" } });
  await gate("plan invalid (no change)", /Plan is not valid/, { changes: { students: "90" } });
  await gate("plan invalid (bad value)", /Plan is not valid/, { changes: { students: "9999" } });
  await gate("writes disabled", /not switched on/, { setup: g => { g.w.REEF_CONFIG.WRITES_ENABLED = false; } });
  await gate("non-ZZZ record", /Only ZZZ test records/, { name: "Real Sample School" });
  await gate("concurrency (record changed since load)", /Someone changed this booking/, { setup: g => { g.st.rec.fields[g.F.modified] = "2026-11-09T09:00:00.000Z"; } });
  await gate("token cannot write", /cannot write/, { setup: g => { g.st.scopes = ["data.records:read"]; return g.D().verify(); } });
  // ---- happy path: one PATCH with only changed fields, then the log row ----
  h = harness({ WRITES_ENABLED: true }); bk = h.set("ZZZ Happy"); await h.goLive();
  pl = h.E().plan(bk, { students: "95", chaps: "14", internalNotes: "call Pat" });
  let res = await h.E().commit(bk, pl, { mode: "live", confirmed: true, reason: "School emailed: 5 more students", user: "rose@example.org" });
  const W = h.writes(), pt = W.find(c => c.method === "PATCH"), lg = W.find(c => c.method === "POST");
  ok(W.length === 2 && res.saved && res.logOk, "commit: exactly one PATCH and one log POST on success");
  ok(JSON.stringify(Object.keys(pt.body.fields).sort()) === JSON.stringify([h.F.students, h.F.internalNotes].sort()) && pt.body.typecast === false, "commit: PATCH sends only the changed fields (unchanged chaperones omitted) with typecast false");
  const lf = lg.body.records[0].fields, X = h.D().FX.comms;
  ok(lf[X.what] === "Other" && lf[X.summary] === "App edit: # Students, Internal notes" && lf[X.booking][0] === bk.id && lg.body.typecast === false, "change log: Communications Log row, What = \"Other\", Summary lists the field labels, booking linked");
  ok(/Students: 90 -> 95/.test(lf[X.details]) && /Internal notes: \(blank\) -> call Pat/.test(lf[X.details]) && /Reason: School emailed: 5 more students/.test(lf[X.details]) && /Edited by: rose@example\.org via Booking Manager v0\.5\.0-live-edit/.test(lf[X.details]) && /Proposal Version: 3 before, unchanged expected/.test(lf[X.details]), "change log: Details has before -> after, the reason, the editor's email and the version");
  ok(!(X.by in lf) && !Object.values(lf).some(v => v && v.id), "change log: the By (collaborator) field is never written");
  // ---- partial failures ----
  h = harness({ WRITES_ENABLED: true }); bk = h.set("ZZZ Partial"); await h.goLive(); h.st.failLog = true; pl = h.E().plan(bk, { students: "95" });
  res = await h.E().commit(bk, pl, { mode: "live", confirmed: true, reason: "School emailed: 5 more students", user: "rose@example.org" });
  ok(res.saved && !res.logOk && /log boom/.test(res.logError) && /Reason: School emailed/.test(res.log.details) && /Students: 90 -> 95/.test(res.log.details), "partial failure: PATCH ok + log fails reports saved-but-log-failed with the exact log text to copy");
  h = harness({ WRITES_ENABLED: true }); bk = h.set("ZZZ Partial2"); await h.goLive(); h.st.failPatch = true; pl = h.E().plan(bk, { students: "95" });
  ok(await throwsMsg(() => h.E().commit(bk, pl, { mode: "live", confirmed: true, reason: "School emailed: 5 more students", user: "x@y.z" }), /Airtable 422/) && h.writes().filter(c => c.method === "POST").length === 0 && h.writes().length === 1, "partial failure: PATCH fails, the error surfaces and no log row is written");
  // ---- validation ----
  const E0 = h.E(), v = (k, x) => E0.validateField(k, x, h.w.REEF_CONFIG.EDITABLE[k]);
  ok(["abc", "1.5", "-1", "401", ""].every(x => !v("students", x).ok) && v("students", "0").ok && v("students", "400").ok && v("students", " 95 ").value === 95, "validation: students must be a whole number 0-400 (and not blank)");
  ok(!v("chaps", "101").ok && v("chaps", "100").ok && !v("chaps", "2.0").ok, "validation: chaperones 0-100, whole numbers");
  ok(["2027-13-01", "04/05/2027", "2027-02-30", "2027-4-5"].every(x => !v("arrival", x).ok) && v("arrival", "2027-04-05").ok && v("followUp", "").ok, "validation: dates must be real YYYY-MM-DD (blank follow-up allowed)");
  bk = h.set("ZZZ V"); ok(E0.plan(bk, { arrival: "2027-04-20", departure: "2027-04-18" }).errors.departure === "Departure is before arrival" && E0.plan(bk, { arrival: "2027-04-20" }).errors.departure, "validation: departure before arrival is rejected (also when only one date is edited)");
  const ne = E0.plan(bk, { progFees: "1", discount: "0.1", upliftOverride: "0", freeChapOverride: "1", taxExempt: "true", materialsFee: "5", addVendor: "5", manualVendorEst: "1", sessions: "3", buses: "1", boatTrips: "1", contact: "A", email: "a@b.co", phone: "1", total: "5" });
  ok(Object.keys(ne.errors).length === 15 && !ne.ok && Object.values(ne.errors).every(e => /not editable/.test(e)), "validation: price inputs, vendor overrides, sessions, buses, boat trips and contact fields are all rejected as not editable");
  ok(JSON.stringify(Object.keys(h.w.REEF_CONFIG.EDITABLE)) === JSON.stringify(["students", "chaps", "arrival", "departure", "internalNotes", "customerNotes", "special", "nextAction", "followUp"]) && h.w.REEF_CONFIG.EDITABLE.customerNotes.customerFacing && h.w.REEF_CONFIG.EDITABLE.special.customerFacing && ["students", "chaps", "arrival", "departure"].every(k => h.w.REEF_CONFIG.EDITABLE[k].watched), "config: exactly the 9 v1 fields; customerNotes and special are customerFacing; counts and dates are watched");
  // ---- plan warnings ----
  const A = h.set("ZZZ Appr", { [h.F.approved]: true, [h.F.propVer]: 3 });
  let pa = E0.plan(A, { students: "95" }); ok(pa.warnings[0] === "This will un-approve the proposal, raise the Proposal Version from 3 to 4, and alert Martha in Slack. A school page that is already live stays up until it is republished. Re-approve before republishing." && pa.ack.needed && /un-approves the proposal/.test(pa.ack.label) && pa.predicted.propVer === 4 && pa.predicted.approved === false, "plan: approved + students change gives the un-approve / version 3 -> 4 warning, the required checkbox and the prediction");
  pa = E0.plan(A, { internalNotes: "hello" }); ok(!pa.warnings.some(w => /un-approve/.test(w)) && !pa.ack.needed && pa.predicted.propVer === 3, "plan: a notes-only change on an approved booking does not warn about un-approval");
  const AC = h.set("ZZZ Acc", { [h.F.acceptedVer]: 2 }); pa = E0.plan(AC, { chaps: "15" }); ok(pa.warnings.some(w => w === "The school accepted v2. Terms changed after acceptance should go through a Change Request.") && pa.ack.needed, "plan: accepted-version warning and checkbox");
  pa = E0.plan(bk, { arrival: "2027-04-10" }); ok(pa.warnings.some(w => w === "Schedule blocks and vendor availability are NOT moved automatically. Check the Program tab afterwards.") && pa.datesChanged, "plan: date change warns that schedule blocks and vendors are not moved");
  pa = E0.plan(bk, { customerNotes: "<b>hi</b>" }); ok(pa.warnings.some(w => w === "This text can appear on the school's pages after the next publish.") && pa.customerFacingChanged, "plan: customer-facing text warns it can appear on school pages");
  pa = E0.plan(bk, { students: "90", chaps: "14", arrival: "2027-04-15", internalNotes: "" }); ok(pa.diff.length === 0 && !pa.ok && Object.keys(pa.fields).length === 0, "plan: unchanged values produce no diff and nothing to save");
  // ---- post-save verification loop ----
  const f0 = h.F, mkRead = totals => { let n = 0; const delays = []; return { delays, read: async () => ({ id: "rec", fields: { [f0.total]: totals[Math.min(n++, totals.length - 1)], [f0.approved]: false, [f0.propVer]: 4 } }), sleep: async ms => { delays.push(ms); } }; };
  let m1 = mkRead([955.5]); let vr = await E0.verifyAfterSave({ read: m1.read, sleep: m1.sleep, expectedTotal: 955.5, predicted: { approved: false, propVer: 4 } }); ok(vr.match && vr.attempts === 1 && m1.delays.join() === "1500" && vr.predictedMatch === true, "post-save: waits ~1.5s, stops after one read when Airtable's total equals the calculator's");
  m1 = mkRead([771.75, 771.75, 955.5]); vr = await E0.verifyAfterSave({ read: m1.read, sleep: m1.sleep, expectedTotal: 955.5 }); ok(vr.match && vr.attempts === 3 && m1.delays.join() === "1500,2000,2000", "post-save: retries at 2s intervals (up to 2 more) and stops as soon as the totals match");
  m1 = mkRead([771.75]); vr = await E0.verifyAfterSave({ read: m1.read, sleep: m1.sleep, expectedTotal: 955.5, predicted: { approved: true, propVer: 9 } }); ok(!vr.match && vr.attempts === 3 && vr.diff === -183.75 && vr.airtableTotal === 771.75 && vr.predictedMatch === false, "post-save: when totals never agree it stops after 3 reads and reports the difference and the prediction mismatch");
  // ---- confirmation-box wording lives in app.js; checked in the browser below ----
}

/* ======================= v0.5 Live editing in the browser: served with writes ENABLED (test copy only), all Airtable calls mocked ======================= */
const CX = { what: "fldQPFJ8Rs7hawYJ0", details: "fldvZu3MtSzK8Unnd", by: "fldyxKTYlLDF6aUlt" };
async function liveBrowserTests(br) {
  const shots = process.env.SHOTS || "/tmp";
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }), pg = await ctx.newPage(); const errs = [];
  pg.on("pageerror", e => errs.push(e.message));
  const calc = r => { const s = r.fields[f.students], c = r.fields[f.chaps], p = s + c, paid = p - Math.min(c, Math.floor(p / 10)); return Math.round(paid * 35 * 1.05 * 100) / 100; };
  const zb = (id, name, extra) => mk(id, Object.assign({ [f.name]: name, [f.org]: name, [f.status]: "Quoting", [f.arrival]: "2027-05-01", [f.students]: 20, [f.chaps]: 3, [f.approved]: false, [f.propVer]: 1, [f.modified]: "2026-11-02T00:00:00.000Z" }, extra));
  const B = [zb("recLIVE0000000001", "ZZZ Mirror Mismatch", { [f.total]: 1000 }), zb("recLIVE0000000002", "ZZZ Plain Draft", { [f.total]: 771.75 }),
    zb("recLIVE0000000003", "ZZZ Approved Copy", { [f.total]: 771.75, [f.approved]: true, [f.propVer]: 2, [f.approvedVer]: 2 }), zb("recLIVE0000000004", "Real Sample School", { [f.total]: 771.75 })];
  const t2 = Object.assign({}, tbl, { [T.bookings]: B, [T.comms]: [], [T.schedule]: [], [T.checklist]: [], [T.versions]: [] });
  const writes = [], lagged = {};   // lagged[recId] = {readsLeft, apply}: Airtable formulas/guardrail settle a few reads after the PATCH
  await pg.route("https://api.airtable.com/**", async route => {
    const rq = route.request(), u = rq.url(), bodyTxt = rq.postData(), body = bodyTxt ? JSON.parse(bodyTxt) : null;
    if (!(rq.headers().authorization || "").startsWith("Bearer pat_TEST")) return route.fulfill({ status: 401, body: "{}" });
    if (/meta\/whoami/.test(u)) return route.fulfill({ json: { id: "usrX", email: "rose@example.org", scopes: ["data.records:read", "data.records:write"] } });
    let m = u.match(/\/v0\/app\w+\/(tbl\w+)\/listRecords/);
    if (m) { let recs = t2[m[1]] || []; const rid = body && body.filterByFormula && (body.filterByFormula.match(/'(rec\w+)'/) || [])[1];
      if (rid) { recs = recs.filter(r => r.id === rid); const lg = lagged[rid]; if (lg && lg.readsLeft-- <= 0) { lg.apply(); delete lagged[rid]; } }
      return route.fulfill({ json: { records: recs } }); }
    m = u.match(/\/v0\/app\w+\/(tbl\w+)\/(rec\w+)$/);
    if (rq.method() === "PATCH" && m) { writes.push({ method: "PATCH", body }); const r = B.find(x => x.id === m[2]); const old = Object.assign({}, r.fields);
      Object.assign(r.fields, body.fields); r.fields[f.modified] = new Date().toISOString();
      const after = Object.assign({}, r.fields, { [f.total]: calc(r) }); const watched = [f.students, f.chaps, f.arrival, f.departure].some(k => k in body.fields);
      if (old[f.approved] && watched) { after[f.approved] = false; after[f.propVer] = (old[f.propVer] || 0) + 1; }
      const stale = Object.assign({}, r.fields, { [f.total]: old[f.total], [f.approved]: old[f.approved], [f.propVer]: old[f.propVer] }); r.fields = stale; lagged[r.id] = { readsLeft: 2, apply: () => { r.fields = Object.assign(r.fields, after); } };
      return route.fulfill({ json: { id: r.id, fields: body.fields } }); }
    m = u.match(/\/v0\/app\w+\/(tbl\w+)$/);
    if (rq.method() === "POST" && m) { writes.push({ method: "POST", body, table: m[1] }); return route.fulfill({ json: { records: [{ id: "recLOGNEW" }] } }); }
    route.fulfill({ status: 404, body: "{}" });
  });
  const open = async nm => { await pg.click("nav button:has-text('All bookings')"); await pg.click(nm.startsWith("ZZZ") ? "text=Test (ZZZ)" : "text=Active"); await pg.click(`.bcard:has-text('${nm}')`); await pg.click("nav button:has-text('Edit')"); };
  const url2 = "http://localhost:" + srvLive.address().port + "/";
  await pg.goto(url2); await pg.fill("#tok", "pat_TEST123"); await pg.click("#go"); await pg.waitForSelector("#main h2");
  await pg.uncheck("#autoRef");
  // ---- banners & switch ----
  let ban = await pg.textContent("#modeBanner");
  ok(/SANDBOX - nothing is saved\. Changes only show what the price would be\./.test(ban) && await pg.evaluate(() => !document.body.classList.contains("live")), "banner: Sandbox text (exact), no Live border, on every screen including Today");
  ok(await pg.isEnabled("#mbLive") && !/Editing: OFF/.test(await pg.textContent("#statusbar")), "Live switch is enabled when writes are on and the token can write; the old 'Editing: OFF' label is gone");
  ok(await pg.evaluate(() => getComputedStyle(document.getElementById("modeBanner")).position === "sticky"), "banner: sticky at the top");
  await open("ZZZ Plain Draft");
  ok(/Check price \(test only\)/.test(await pg.textContent("#prev")), "Sandbox button reads 'Check price (test only)'");
  await pg.fill("[data-e=students]", "25"); await pg.click("#prev");
  let po = await pg.textContent("#planOut");
  ok(/Would become/.test(po) && /\$772/.test(po) && /\$956/.test(po) && /nothing was saved/i.test(po) && !(await pg.isVisible("#confirmDlg")), "Sandbox: Check price shows before/after price inline, no confirmation box, nothing saved");
  ok(writes.length === 0, "Sandbox flow with writes enabled sent zero PATCH/POST requests");
  ok(/changed, not saved/.test(await pg.textContent("[data-c=students]")), "changed fields are highlighted with words, not colour alone");
  // ---- switch dialog ----
  await pg.focus("#mbLive"); await pg.keyboard.press("Enter");
  ok(await pg.isVisible("#liveDlg") && /Switch to Live\?[^]*Saves go straight to Airtable and are logged under your name\. Nothing is sent to a school\./.test(await pg.textContent("#liveDlg")), "keyboard: Enter on the switch opens the 'Switch to Live?' dialog with the required wording");
  await pg.keyboard.press("Escape"); ok(!(await pg.isVisible("#liveDlg")) && /SANDBOX/.test(await pg.textContent("#modeBanner")), "Escape closes the dialog and stays in Sandbox");
  await pg.click("#mbLive"); await pg.click("#lvCancel"); ok(/SANDBOX/.test(await pg.textContent("#modeBanner")), "Cancel stays in Sandbox");
  await pg.click("#mbLive"); await pg.click("#lvGo");
  ok(/LIVE - changes save to Airtable\./.test(await pg.textContent("#modeBanner")) && await pg.isVisible("#mbBack") && await pg.evaluate(() => document.body.classList.contains("live") && getComputedStyle(document.body).borderTopWidth === "8px"), "Live: red banner text (exact), 'Back to Sandbox' button and a thick page border");
  await pg.screenshot({ path: `${shots}/live-banner-1280.png` });
  ok(/Review change/.test(await pg.textContent("#prev")) && (await pg.inputValue("[data-e=students]")) === "25", "Live button reads 'Review change'; typed values survive the mode switch");
  // ---- confirmation box: escaping, gating, mirror-mismatch note ----
  await open("ZZZ Mirror Mismatch");
  await pg.fill("[data-e=customerNotes]", `<img src=x onerror="window.__xss=1"><b>bold</b> & "q"`); await pg.fill("[data-e=students]", "22"); await pg.click("#prev"); await pg.waitForSelector("#confirmDlg[open]");
  let dt = await pg.textContent("#confirmDlg");
  ok(dt.includes(`<img src=x onerror="window.__xss=1"><b>bold</b> & "q"`) && await pg.evaluate(() => !window.__xss && !document.querySelector("#confirmDlg img") && ![...document.querySelectorAll("#confirmDlg b")].some(x => x.textContent === "bold")), "confirmation box escapes HTML in notes (shown as text, nothing runs or renders)");
  ok(/Students<\/b>: 20 -&gt; 22|# Students: 20 -> 22/.test(await pg.innerHTML("#confirmDlg")) || /# Students: 20 -> 22/.test(dt), "confirmation box: one line per field, 'Label: old -> new'");
  ok(/Customer-facing notes: \(blank\) -> /.test(dt), "confirmation box: blank old value shows as (blank)");
  ok(/The calculator does not match Airtable for this booking, so the new price below may be off\. Airtable's recalculated total is the real number\./.test(dt), "confirmation box: red note when the mirror does not match Airtable's stored total");
  ok(/This text can appear on the school's pages after the next publish\./.test(dt) && !/un-approve/.test(dt) && !(await pg.$("#cfAck")), "confirmation box: customer-facing warning; no un-approve warning or checkbox on an unapproved booking");
  ok(!/margin|Total program cost|Net income/i.test(dt), "confirmation box never shows cost or margin");
  ok(await pg.isDisabled("#cfSave") && /Save live change/.test(await pg.textContent("#cfSave")), "Save is disabled until a reason is entered");
  await pg.fill("#cfReason", "too short"); ok(await pg.isDisabled("#cfSave"), "Save stays disabled for a reason under 10 characters");
  await pg.fill("#cfReason", "School emailed: 2 more students"); ok(await pg.isEnabled("#cfSave"), "Save enables once the reason is 10+ characters (unapproved booking needs no checkbox)");
  await pg.keyboard.press("Tab"); ok(await pg.evaluate(() => document.getElementById("confirmDlg").contains(document.activeElement)), "keyboard: focus stays inside the open confirmation box");
  await pg.keyboard.press("Escape"); ok(!(await pg.isVisible("#confirmDlg")) && writes.length === 0, "Escape closes the confirmation box and nothing was saved");
  ok((await pg.inputValue("[data-e=students]")) === "22" && /not saved/.test(await pg.textContent("#unsavedNote")), "form keeps typed values after cancelling, marked 'not saved'");
  // phone width
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.click("#prev"); await pg.waitForSelector("#confirmDlg[open]");
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && document.getElementById("confirmDlg").scrollWidth <= document.getElementById("confirmDlg").clientWidth + 1), "confirmation box at 390px: no horizontal scroll");
  await pg.screenshot({ path: `${shots}/live-confirm-390.png` }); await pg.keyboard.press("Escape");
  await pg.screenshot({ path: `${shots}/live-edit-390.png`, fullPage: true }); ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Live edit tab at 390px: no horizontal scroll");
  await pg.setViewportSize({ width: 1280, height: 900 });
  // ---- non-ZZZ, invalid input ----
  await open("Real Sample School"); await pg.fill("[data-e=students]", "30"); await pg.click("#prev");
  ok(/Only ZZZ test records may be saved live/.test(await pg.textContent("#planOut")) && !(await pg.isVisible("#confirmDlg")), "Live: a non-ZZZ record is refused before the confirmation box opens");
  await open("ZZZ Plain Draft"); await pg.fill("[data-e=students]", "abc"); ok(/Whole number required/.test(await pg.textContent("#err_students")), "inline field error appears as you type");
  await pg.click("#prev"); ok(!(await pg.isVisible("#confirmDlg")) && /Whole number/.test(await pg.textContent("#planOut")), "Live: an invalid entry never opens the confirmation box");
  await pg.click("#resetEdit");
  // ---- approved booking: ack gate, real save, verification ----
  await open("ZZZ Approved Copy"); await pg.fill("[data-e=students]", "25"); await pg.click("#prev"); await pg.waitForSelector("#confirmDlg[open]"); dt = await pg.textContent("#confirmDlg");
  ok(/This will un-approve the proposal, raise the Proposal Version from 2 to 3, and alert Martha in Slack\. A school page that is already live stays up until it is republished\. Re-approve before republishing\./.test(dt) && /\$772/.test(dt) && /\$956/.test(dt) && !/does not match Airtable/.test(dt), "approved booking: un-approve / version 2 -> 3 text and price before/after (mirror matches Airtable, so no red note)");
  await pg.fill("#cfReason", "School emailed: 5 more students"); ok(await pg.isDisabled("#cfSave") && /I understand this un-approves the proposal/.test(dt), "approved booking: Save stays disabled until the checkbox is ticked");
  await pg.check("#cfAck"); ok(await pg.isEnabled("#cfSave"), "ticking the checkbox (with a reason) enables Save");
  await pg.screenshot({ path: `${shots}/live-confirm-1280.png` });
  await pg.click("#cfSave"); await pg.waitForFunction(() => !document.getElementById("confirmDlg").open);
  ok(writes.length === 2 && writes[0].method === "PATCH" && JSON.stringify(Object.keys(writes[0].body.fields)) === JSON.stringify([f.students]) && writes[0].body.typecast === false && writes[1].method === "POST" && writes[1].body.records[0].fields[CX.what] === "Other" && !(CX.by in writes[1].body.records[0].fields), "save sends one PATCH (changed field only, typecast false) then one log row with What = Other and no By");
  ok(/rose@example\.org/.test(writes[1].body.records[0].fields[CX.details]) && /School emailed: 5 more students/.test(writes[1].body.records[0].fields[CX.details]), "the log row records the reason and the editor's email");
  // go type on another booking while the verification retries run: it must not be overwritten
  await open("ZZZ Plain Draft"); await pg.fill("[data-e=chaps]", "7");
  await pg.waitForTimeout(4500);
  ok((await pg.inputValue("[data-e=chaps]")) === "7", "post-save re-reads and the auto-refresh timer never overwrite unsaved typing on another booking");
  await open("ZZZ Approved Copy"); await pg.waitForSelector("#resultCard");
  let rt = await pg.textContent("#saveResult");
  ok(/Saved/.test(rt) && /Airtable's recalculated total\s*\$955\.50/.test(rt) && /Calculator's expected total\s*\$955\.50/.test(rt) && /agree/.test(rt), "result panel: Saved, Airtable's recalculated total vs the calculator's expected total");
  ok(/Predicted: Approved to Share off, Proposal Version 3\. Observed in Airtable: Approved to Share off, Proposal Version 3\. ✓ As predicted\./.test(rt), "result panel: predicted vs observed Approved flag and Proposal Version");
  ok(/School emailed: 5 more students/.test(await pg.textContent("#recent")) && /# Students: 20 -> 25/.test(await pg.textContent("#recent")), "'Recent changes this session' lists field, old -> new, reason and time");
  await pg.screenshot({ path: `${shots}/live-result-1280.png`, fullPage: true });
  // ---- concurrency ----
  await pg.click("nav button:has-text('Today')"); await open("ZZZ Plain Draft"); await pg.click("#resetEdit").catch(() => {}); await pg.fill("[data-e=internalNotes]", "call Pat on Monday"); await pg.click("#prev"); await pg.waitForSelector("#confirmDlg[open]");
  B[1].fields[f.modified] = "2026-11-09T12:00:00.000Z";   // someone edits the record in Airtable between load and save
  const wBefore = writes.length; await pg.fill("#cfReason", "Rose asked for a note"); await pg.click("#cfSave"); await pg.waitForSelector("#cfErr:not([hidden])");
  ok(/Someone changed this booking since you opened it\. Reload and re-apply\./.test(await pg.textContent("#cfErr")) && writes.length === wBefore && await pg.isEnabled("#cfCancel"), "concurrency: the app refuses and sends nothing when Airtable changed since load");
  await pg.click("#cfCancel");
  // ---- idle timeout ----
  await pg.evaluate(() => { REEF_CONFIG.LIVE_IDLE_MS = 3000; REEF_CONFIG.LIVE_WARN_MS = 2500; ReefMode.touch(); });
  await pg.waitForFunction(() => /SANDBOX/.test(document.getElementById("modeBanner").textContent), null, { timeout: 8000 });
  ok(await pg.evaluate(() => !document.body.classList.contains("live")) && !(await pg.isHidden("#toast")) && /no activity/.test(await pg.textContent("#toast")), "idle timeout: banner returns to Sandbox and a one-line toast says why");
  ok((await pg.inputValue("[data-e=internalNotes]")) === "call Pat on Monday" && /not saved/.test(await pg.textContent("#unsavedNote")), "idle timeout: typed values stay in the form, marked 'not saved'");
  await pg.evaluate(() => { REEF_CONFIG.LIVE_IDLE_MS = 900000; REEF_CONFIG.LIVE_WARN_MS = 120000; });
  // ---- disconnect drops Live ----
  await pg.click("#mbLive"); await pg.click("#lvGo"); ok(/LIVE/.test(await pg.textContent("#modeBanner")), "Live can be re-entered");
  await pg.click("#disc"); ok(/SANDBOX/.test(await pg.textContent("#modeBanner")) && await pg.evaluate(() => !ReefMode.isLive() && !document.body.classList.contains("live")), "Disconnect (token cleared) drops Live to Sandbox");
  ok(errs.length === 0, "no JavaScript errors in the Live-mode run" + (errs.length ? ": " + errs.join("|") : ""));
  await ctx.close();
}
(async () => {
  await new Promise(r => srv.listen(0, r)); await new Promise(r => srvLive.listen(0, r)); await unitTests(); const url = "http://localhost:" + srv.address().port + "/";
  const br = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}); const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
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
  ok(await pg.isDisabled("#mbLive") && /Live editing is not switched on yet/.test(await pg.textContent("#modeBanner")) && /SANDBOX - nothing is saved/.test(await pg.textContent("#modeBanner")), "shipped build: Sandbox banner shows and the Live switch is disabled with 'Live editing is not switched on yet'");
  await pg.screenshot({ path: (process.env.SHOTS || "/tmp") + "/sandbox-switch-disabled-1280.png" });
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
  ok(/Would become/.test(await pg.textContent("#planOut")) && (await pg.$("#planOut button")) === null && /nothing was saved/i.test(await pg.textContent("#planOut")), "valid change shows diff and the price check; Sandbox offers no save button");
  // approved booking warning
  await pg.click("nav button:has-text('Today')"); await pg.click("text=All bookings"); await pg.click(".bcard:has-text('Sample Prep')"); await pg.click("nav button:has-text('Edit')");
  await pg.fill("[data-e=students]", "61"); await pg.click("#prev");
  ok(/un-approve the proposal, raise the Proposal Version from 2 to 3/.test(await pg.textContent("#planOut")), "approved booking: warns about un-approve + version bump (2 to 3)");
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
  await liveBrowserTests(br);
  await br.close(); srv.close(); srvLive.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
