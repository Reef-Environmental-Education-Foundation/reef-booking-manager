/* Vendor and rate picker: logic tests. SYNTHETIC data only (tests/vendors-fixture.js). Run: node tests/vendors.js (no browser, no network). */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, ".."); const FX = require("./vendors-fixture.js");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + m); };
function load(over) {
  const ctx = { console, window: {}, setTimeout, clearTimeout, setInterval, clearInterval, fetch: async () => { throw new Error("no network in unit tests"); } };
  vm.createContext(ctx);
  for (const f of ["config", "mode", "adapter-airtable", "pricing", "edits", "vendors"]) vm.runInContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), ctx);
  if (over) Object.assign(ctx.window.REEF_CONFIG, over); return ctx.window;
}
const w = load(), V = w.ReefVendors, C = w.REEF_CONFIG, F = C.F;
const idx = V.index({ rates: FX.rates, vendors: FX.vendors, activities: FX.activities });
const R = id => idx.byId[id], ids = list => list.map(r => r.id).sort().join();

/* ---- Stage 1: config and classification ---- */
ok(F.divers === "fldaBe4HJfQI1BmCC" && F.snorkelers === "fldSUco1o4mGgwu3T" && F.pricingRates === "fldsQ4wzMfg0qLlVM" && F.vendorMissing === "fldIxxmRGSbWqJV49", "config F: # Divers, # Snorkelers, Pricing Rates and Vendor Rates Missing field IDs");
ok(!("pricingRates" in C.EDITABLE) && !("divers" in C.EDITABLE) && !("snorkelers" in C.EDITABLE) && Object.keys(C.EDITABLE).length === 9, "config EDITABLE is untouched: no link field and no picker field in it");
ok(JSON.stringify(V.ALLOWLIST) === JSON.stringify(["pricingRates", "divers", "snorkelers"]), "vendors.js write allowlist is exactly Pricing Rates, # Divers, # Snorkelers");
ok(!/WRITES_ENABLED\s*[:=]/.test(fs.readFileSync(path.join(root, "js/vendors.js"), "utf8")), "vendors.js never sets WRITES_ENABLED");
const cl = id => { const r = R(id); return r.slot + "/" + r.model + (r.svc ? "/" + r.svc : ""); };
ok(cl("recR1") === "snorkel/pp" && cl("recR8") === "snorkel/boat" && cl("recR2") === "dive/set" && cl("recR7") === "gear/set" && cl("recR19") === "kayak/set" && cl("recR18") === "penn/set", "classify: snorkel per-person, snorkel per-boat, dive, gear, kayak, Pennekamp");
ok(cl("recR5") === "capacity/set/snorkel" && cl("recR6") === "capacity/set/dive", "classify: capacity records, snorkel and dive");
ok(cl("recR11") === "snorkel/boat", "classify: an older per-boat charter key with no service word is a snorkel per-boat rate (by its $/boat unit)");
ok(cl("recR12") === "snorkel/pp" && cl("recR13") === "dive/set", "classify: a vendor named 'Delta Dives' does not turn its snorkel rates into dive rates");
ok(cl("recR20") === "other/set", "classify: glass-bottom boat rates are left alone (not a picker category)");
ok(R("recR1").stem === "alpha_snorkel_pp" && R("recR1b").stem === "alpha_snorkel_pp", "stem: the 2026 and 2027 versions of one rate share a stem");
ok(R("recR1").pending && R("recR1").confirmBefore && !R("recR1").active && R("recR1").value === 75, "rate model: pending, confirm-before, Active off, value from the currency field");
ok(R("recR5").value === 30 && R("recR5").unit === "passengers", "rate model: capacity value comes from Rate Value Number");
ok(V.capacityOf(idx, "recVA").snorkel === 30 && V.capacityOf(idx, "recVA").dive === 20 && V.capacityOf(idx, "recVD").snorkel === 40 && V.capacityOf(idx, "recVD").dive === null, "capacity: snorkel and dive per vendor, null when not on file");

/* ---- Stage 2: options and eligibility ---- */
const names = (slot, arr) => V.options(idx, slot, arr).map(o => V.optionLabel(o));
ok(JSON.stringify(names("snorkel", "2027-05-01")) === JSON.stringify(["Alpha Marine (per person)", "Bravo Charters (per boat charter)", "Delta Dives (per person)"]), "options: snorkel lists each vendor once per pricing model");
ok(!names("snorkel", "2027-05-01").some(n => /Zulu|Yankee/.test(n)), "options: Placeholder - Not Real and Not Available rates are hidden");
ok(!R("recR1").active && names("snorkel", "2027-05-01")[0].startsWith("Alpha"), "options: the Active checkbox is not used (Active-off 2027 rates are listed)");
const so = (slot, arr, v) => V.options(idx, slot, arr).find(o => o.vendorId === v);
ok(so("snorkel", "2027-05-01", "recVA").rates[0].id === "recR1" && !so("snorkel", "2027-05-01", "recVA").afterArrival, "dates: rate dated on or before arrival wins (newest first)");
ok(so("snorkel", "2026-06-01", "recVA").rates[0].id === "recR1b", "dates: for a 2026 arrival the 2026 sheet is used, not the 2027 one");
ok(so("snorkel", "2027-05-01", "recVD").rates[0].value === 80, "dates: a later-dated (2028) sheet is not picked for a 2027 arrival");
const aft = so("snorkel", "2026-01-01", "recVD");
ok(aft.afterArrival && aft.rates[0].eff === "2027-01-01", "dates: only after-arrival sheets exist, so the earliest is listed and flagged 'after this arrival'");
ok(so("snorkel", "2027-05-01", "recVB").rates.length === 1 && so("snorkel", "2027-05-01", "recVB").rates[0].id === "recR8", "options: older and newer per-boat charter keys collapse to the newest single record");
ok(ids(so("dive", "2027-05-01", "recVA").rates) === ["recR2", "recR3", "recR4"].join(), "options: a dive option carries the vendor's dive rate, first guide and additional guide records");
ok(so("snorkel", "2027-05-01", "recVA").pending && so("snorkel", "2027-05-01", "recVA").confirmBefore && !so("snorkel", "2027-05-01", "recVD").pending, "options: pending and confirm-before flags");
ok(so("snorkel", "2027-05-01", "recVA").notes[0] === "Check-in 8:30 AM. Gear included. REEF staff free." && so("snorkel", "2027-05-01", "recVA").capacity.snorkel === 30, "options: notes (check-in and inclusions) and capacity travel with the option");
ok(V.options(idx, "snorkel", null).find(o => o.vendorId === "recVA").rates[0].id === "recR1" && !V.options(idx, "snorkel", null)[0].afterArrival, "dates: no arrival date means newest rate, no after-arrival note");
ok(V.options(idx, "penn", "2027-05-01")[0].rates.map(r => r.stem).join() === "coastal_park_entrance,coastal_park_snorkel_adult", "options: Pennekamp option carries each kind of Pennekamp rate once");

/* ---- current links ---- */
const bk = (extra) => ({ id: "recBK", actNames: ["Boat Snorkel", "Pennekamp"], raw: Object.assign({ [F.name]: "ZZZ Fixture", [F.arrival]: "2027-05-01", [F.students]: 20, [F.chaps]: 5, [F.boatTrips]: 2 }, extra || {}) });
let cur = V.current(bk({ [F.pricingRates]: ["recR8", "recR10", "recR9", "recUNKNOWN0000001"] }), idx);
ok(cur.by.snorkel.length === 1 && cur.by.gear.length === 1 && cur.by.capacity.length === 1 && cur.unknown.length === 1, "current: linked rates grouped by category, unknown ids kept aside");
ok(V.current(bk(), idx).ids.length === 0, "current: a booking with nothing linked is empty, not an error");
cur = V.current(bk({ [F.pricingRates]: ["recR1", "recR8"] }), idx);
ok(V.conflicts(cur).length === 1 && /Alpha Marine/.test(V.conflicts(cur)[0].vendors.join()), "conflicts: two vendors linked in one category are reported (Airtable prices at the higher)");
ok(V.neededSlots(bk(), V.current(bk(), idx)).join() === "snorkel,gear,penn", "needed categories come from requested activities");
const mo = V.matchOption(V.options(idx, "snorkel", "2027-05-01"), V.current(bk({ [F.pricingRates]: ["recR8"] }), idx).by.snorkel);
ok(mo && mo.option.vendorId === "recVB" && mo.exact, "pre-select: the option matching the linked records");

/* ---- Stage 2: plan (replace within a category, no duplicates, leftovers) ---- */
const B = (links, extra) => bk(Object.assign({ [F.pricingRates]: links }, extra || {}));
const P = (b, choices, counts, o) => V.plan(b, idx, Object.assign({ choices: choices || {}, counts: counts || {} }, o || {}));
const fin = p => p.links.after.slice().sort().join();
let p = P(B(["recR8", "recR10", "recR9"]), { snorkel: "recVA|pp" });
ok(p.ok && p.links.after.join() === "recR1" && p.switched.from === "boat" && p.switched.to === "pp", "plan: per-boat to per-person replaces the charter and reports the switch");
ok(ids(p.leftover) === ["recR8", "recR10", "recR9"].sort().join() && ids(p.links.removed) === ["recR8", "recR10", "recR9"].sort().join(), "plan: per-boat to per-person lists the leftover charter, gear and capacity records and removes them in the same save");
p = P(B(["recR1"]), { snorkel: "recVB|boat" });
ok(p.links.after.join() === "recR8" && p.switched.from === "pp" && ids(p.leftover) === "recR1", "plan: per-person to per-boat replaces the per-person record (no cross-category removal)");
p = P(B(["recR8", "recR19", "recR17", "recR7"]), { snorkel: "recVD|pp" });
ok(p.links.after.includes("recR19") && p.links.after.includes("recR17") && p.links.after.includes("recR12") && !p.links.after.includes("recR8"), "plan: one record per category: the snorkel pick replaces the old snorkel record and leaves kayak and Pennekamp alone");
ok(p.links.after.includes("recR7") && !p.leftover.some(r => r.id === "recR7"), "plan: only snorkel gear is a leftover of a per-boat to per-person switch; other gear (dive gear) is kept");
p = P(B(["recR7", "recR2"]), { dive: "recVA|set" });
ok(p.links.after.length === new Set(p.links.after).size && ids(p.links.added) === ["recR2", "recR3", "recR4"].join() && p.links.after.length === 4, "plan: duplicates are prevented (an already-linked record is not linked twice)");
p = P(B(["recR1"]), { snorkel: "recVA|pp" });
ok(!p.ok && p.diff.length === 0 && Object.keys(p.fields).length === 0, "plan: choosing what is already linked changes nothing");
p = P(B(["recR1", "recR3"]), { dive: "__current" }); ok(!p.ok, "plan: leaving a non-picker set as 'currently linked' changes nothing");
p = P(B(["recR8", "recR19"]), { snorkel: "none" }); ok(p.links.after.join() === "recR19" && p.switched === null, "plan: 'no vendor' clears only that category");
p = P(B([]), { snorkel: "recVZ|pp" }); ok(p.errors.snorkel && !p.ok, "plan: a hidden (placeholder) vendor cannot be chosen");
ok(P(B(["recR8", "recUNKNOWN0000001"]), { snorkel: "recVA|pp" }).links.after.includes("recUNKNOWN0000001"), "plan: linked records the picker does not know are kept");
p = P(B(["recR8"]), { snorkel: "recVA|pp" }, { divers: "12", snorkelers: "30" });
ok(p.fields[F.divers] === 12 && p.fields[F.snorkelers] === 30 && Object.keys(p.fields).every(k => [F.pricingRates, F.divers, F.snorkelers].includes(k)), "plan: # Divers and # Snorkelers are saved as integers; the PATCH fields are only on the allowlist");
ok(P(B([]), {}, { divers: "401" }).errors.divers === "Must be 0 to 400" && P(B([]), {}, { divers: "x" }).errors.divers && P(B([]), {}, { snorkelers: "-1" }).errors.snorkelers, "plan: counts must be whole numbers 0-400");
ok(!P(B([]), {}, { divers: "", snorkelers: "" }).ok, "plan: blank counts on a booking that has none are 'not set', no change");
p = P(B([], { [F.divers]: 8 }), {}, { divers: "" }); ok(p.ok && p.fields[F.divers] === null, "plan: clearing a count writes blank");
p = P(B(["recR8"], { [F.approved]: true, [F.propVer]: 2 }), { snorkel: "recVA|pp" });
ok(p.warnings[0] === "Saving will un-approve this proposal, bump the Proposal Version and alert Martha in Slack; the live page stays up until re-approved and republished." && p.acks.some(a => a.id === "approve") && p.predicted.propVer === 3 && p.predicted.approved === false, "plan: Approved to Share shows the exact un-approve warning and needs a tick");
p = P(B(["recR8"], { [F.approved]: true }), {}, { divers: "5" });
ok(!p.warnings.some(w => /un-approve/.test(w)) && !p.acks.some(a => a.id === "approve") && p.predicted.approved === true, "plan: # Divers and # Snorkelers alone say nothing about un-approving (not yet watched by the guardrail)");
p = P(B(["recR8"], { [F.agreementStatus]: "Signed" }), { snorkel: "recVA|pp" }); ok(p.acks.some(a => a.id === "locked") && /Contract Status Signed/.test(p.warnings.join()), "plan: Signed needs the extra tick");
p = P(B(["recR8"], { [F.agreementStatus]: "Sent" }), {}, { divers: "5" }); ok(p.acks.some(a => a.id === "locked"), "plan: Contract Status Sent needs the extra tick, even for a count change");
p = P(B(["recR8"], { [F.pricingModel]: "Legacy (completed)" }), { snorkel: "recVA|pp" }); ok(p.acks.some(a => a.id === "locked") && /Legacy \(completed\)/.test(p.warnings.join()), "plan: Legacy (completed) needs the extra tick");
p = P(B(["recR8"]), { snorkel: "recVA|pp" }); ok(!p.acks.length && p.pendingAdded.length === 1 && /test record/.test(p.warnings.join()), "plan: pending rate on a ZZZ test record is flagged but needs no tick");
const real = B(["recR8"], { [F.name]: "Synthetic Real School - 2027" }); p = P(real, { snorkel: "recVA|pp" });
ok(p.acks.some(a => a.id === "pending") && !p.isTestRecord, "plan: saving a pending rate on a real booking needs the acknowledgment tick");
p = P(real, { snorkel: "recVD|pp" }); ok(!p.acks.some(a => a.id === "pending"), "plan: a confirmed rate on a real booking needs no pending tick");

/* ---- Stage 3: capacity ---- */
const CAP = (links, extra, counts) => V.capacity(bk(Object.assign({ [F.pricingRates]: links }, extra || {})), idx, links, counts);
const kinds = c => c.items.map(i => i.kind).join();
let c = CAP(["recR1"], { [F.students]: 28, [F.chaps]: 5, [F.boatTrips]: 1 }); ok(/snorkel-over/.test(kinds(c)) && c.hasAmber, "capacity: snorkelers over the snorkel capacity warn (amber)");
c = CAP(["recR1"], { [F.boatTrips]: 1 }); ok(kinds(c).includes("snorkel-ok") && !c.hasAmber && c.assumed, "capacity: 25 snorkelers fit 30");
ok(c.items.some(i => i.kind === "assumed" && /students \+ chaperones \(25\)/.test(i.text)), "capacity: blank # Snorkelers uses students + chaperones and says so");
c = CAP(["recR1", "recR2"], { [F.boatTrips]: 1, [F.snorkelers]: 10 }, { divers: "25" }); ok(/dive-over/.test(kinds(c)) && /snorkel-ok/.test(kinds(c)), "capacity: divers over the dive capacity warn on their own");
c = CAP(["recR1", "recR2"], { [F.boatTrips]: 1 }, { snorkelers: "15", divers: "18" });
ok(/mixed-over/.test(kinds(c)) && c.items.find(i => i.kind === "mixed-over").text.includes("lower of the two capacities (20)") && /snorkel-ok/.test(kinds(c)) && /dive-ok/.test(kinds(c)), "capacity: mixed group shows each check and the combined headcount against the lower capacity (warning)");
c = CAP(["recR1", "recR2"], { [F.boatTrips]: 1 }, { snorkelers: "8", divers: "10" }); ok(/mixed-ok/.test(kinds(c)) && c.items.find(i => i.kind === "mixed-ok").level === "amber", "capacity: a mixed group that fits is still flagged, the mixed-trip limit may be lower");
c = CAP(["recR12", "recR13"], { [F.boatTrips]: 1, [F.snorkelers]: 10 }, { divers: "5" }); ok(/dive-nocap/.test(kinds(c)) && c.items.find(i => i.kind === "dive-nocap").text.includes("capacity not on file") && /mixed-nocap/.test(kinds(c)), "capacity: a vendor with no capacity record says 'capacity not on file'");
c = CAP(["recR1", "recR13"], { [F.boatTrips]: 1 }, { snorkelers: "10", divers: "5" }); ok(/mixed-differ/.test(kinds(c)) && !/mixed-over/.test(kinds(c)), "capacity: different snorkel and dive vendors get no invented combined limit");
c = CAP(["recR1"], { [F.boatTrips]: 2 }); ok(/trips/.test(kinds(c)) && /per trip/.test(c.items.find(i => i.kind === "trips").text) && /how the group is split/.test(c.items.find(i => i.kind === "trips").text), "capacity: more than one trip says capacity is per trip and flags the unknown split");
c = CAP(["recR1"], { [F.boatTrips]: 1 }); ok(!/trips/.test(kinds(c)), "capacity: one trip gets no per-trip note");
c = CAP([], { [F.boatTrips]: 1 }); ok(/none/.test(kinds(c)) && !c.hasAmber, "capacity: no vendor chosen is an info line, not a warning");
ok(JSON.stringify(V.parseCount("")) === '{"blank":true,"value":null}' && V.parseCount("7").value === 7 && V.parseCount("x").bad, "counts: blank means not set");

/* ---- Stage 4: pricing mirror and cost preview ---- */
const PR = w.ReefPricing, sv = (i, x) => PR.snorkelVendor(Object.assign({ students: 20, chaps: 5, staff: 2, trips: 2, acts: "Boat Snorkel" }, i), x);
ok(sv({}, { pp: 75 }).cost === 3750 && sv({}, { pp: 75 }).model === "pp", "mirror: per-person snorkel, 75 per person, 20 students + 5 chaperones, 2 trips = 3,750 (REEF staff free)");
ok(sv({ staff: 9 }, { pp: 75 }).cost === 3750, "mirror: per-person cost does not change with REEF staff aboard");
ok(sv({ trips: 0 }, { pp: 75 }).cost === 1875, "mirror: zero trips count as one, as in Airtable");
ok(sv({}, { charter: 900, cap: 15, gear: 25 }).cost === 4 * 900 + 25 * 25 && sv({}, { charter: 900, cap: 15, gear: 25 }).departures === 4, "mirror: per-boat charter, ceil(27 aboard / 15) x 2 trips = 4 departures x 900 + 25 people x 25 gear = 4,225");
ok(sv({}, { charter: 900, cap: 15 }).cost === 3600, "mirror: per-boat with no gear linked adds no gear");
ok(sv({}, { charter: 900 }).incomplete.join() === "capacity per vessel" && sv({}, { charter: 900 }).cost === 0, "mirror: per-boat with no capacity on file is incomplete, not guessed");
ok(sv({}, { pp: 75, charter: 900, cap: 15, gear: 25 }).model === "pp" && sv({}, { pp: 75, charter: 900, cap: 15, gear: 25 }).cost === 3750, "mirror: when a per-person rate is linked it is the vendor cost (no charter or gear added)");
ok(sv({ acts: "Kayaking" }, { pp: 75 }).cost === 0 && sv({}, {}).model === "none", "mirror: no Boat Snorkel activity, or no rate, means no snorkel vendor cost");
const mr = ids2 => V.mirrorRates(idx, ids2);
ok(mr(["recR1", "recR12"]).pp === 80 && mr(["recR8", "recR11"]).charter === 900 && mr(["recR8"]).cap === 15 && mr(["recR8", "recR10"]).gear === 25, "mirror rates: the highest linked rate of each kind (as Airtable's rollups), vendor capacity for per-boat");
const fakeP = { isReady: () => true, R: { uplift: 0.05 }, snorkelVendor: PR.snorkelVendor };
const inp = { students: 20, chaps: 5, staff: 0, trips: 2, acts: "Boat Snorkel" };
const bb = B(["recR8", "recR10", "recR9"], { [F.total]: 10000, [F.vendorAuto]: 1800 });
let pv = V.preview(bb, idx, P(bb, { snorkel: "recVA|pp" }), fakeP, inp);
ok(pv.available && pv.before.cost === 4225 && pv.after.cost === 3750 && pv.delta === -475 && pv.vendorAfter === 1325 && pv.totalAfter === 9501.25 && pv.expectedTotal === 9501.25, "preview: per-boat to per-person: vendor cost 1,800 -> 1,325 and total 10,000 -> 9,501.25 (uplift 5% on the change)");
pv = V.preview(bb, idx, P(bb, { snorkel: "recVA|pp" }), Object.assign({}, fakeP, { R: { uplift: 0.05 } }), Object.assign({}, inp, { acts: "Kayaking" }));
ok(pv.available && pv.delta === 0 && pv.totalAfter === 10000, "preview: a booking without the Boat Snorkel activity shows no change");
pv = V.preview(B(["recR1"], { [F.total]: 5000, [F.vendorAuto]: 3750, [F.manualVendorEst]: 4000 }), idx, P(B(["recR1"]), { snorkel: "recVD|pp" }), fakeP, inp);
ok(pv.available && pv.delta === 250 && pv.totalAfter === 5000 && /manual Estimated Vendor Cost/.test(pv.notes.join()), "preview: a manual vendor estimate keeps the total and says so");
pv = V.preview(bb, idx, P(bb, { snorkel: "recVB|boat" }), fakeP, inp); ok(!pv.available, "preview: no rate change, no preview");
pv = V.preview(B(["recR1"], { [F.total]: 5000 }), idx, P(B(["recR1"]), { snorkel: "recVB|boat" }), fakeP, inp); ok(pv.available && pv.after.cost === 3600 && pv.delta === -150, "preview: per-person to per-boat (no gear linked yet) 3,750 -> 3,600");
pv = V.preview(bb, idx, P(bb, { dive: "recVA|set" }), fakeP, inp); ok(pv.available && pv.delta === 0 && /Boat dive.*not priced in this preview/i.test(pv.notes.join()), "preview: dive changes are not priced and the preview says so");
pv = V.preview(bb, idx, P(bb, { snorkel: "recVA|pp" }), { isReady: () => false }, inp); ok(!pv.available && /not loaded/.test(pv.reason), "preview: unavailable when the Rates constants are not loaded");
pv = V.preview(B(["recR1"], { [F.total]: 5000 }), idx, P(B(["recR1"]), { snorkel: "recVB|boat" }), fakeP, inp);
const noCapIdx = V.index({ rates: FX.rates.filter(r => r.id !== "recR9"), vendors: FX.vendors, activities: FX.activities });
pv = V.preview(B(["recR1"], { [F.total]: 5000 }), noCapIdx, V.plan(B(["recR1"]), noCapIdx, { choices: { snorkel: "recVB|boat" } }), fakeP, inp); ok(!pv.available && /capacity per vessel/.test(pv.reason), "preview: per-boat vendor with no capacity record is flagged, not guessed");

(async () => {
/* ---- Stage 5: guarded write (fetch mocked, no network) ---- */
function harness(cfgOver) {
  const calls = [], st = { scopes: ["data.records:read", "data.records:write"], rec: null, failLog: false, failPatch: false };
  const Rr = (j, status) => ({ ok: (status || 200) < 400, status: status || 200, json: async () => j });
  const ctx = { console, window: {}, setTimeout, clearTimeout, setInterval: () => 1, clearInterval: () => {},
    fetch: async (url, init) => { init = init || {}; const body = init.body ? JSON.parse(init.body) : null, method = init.method || "GET"; calls.push({ method, url, body });
      if (/meta\/whoami/.test(url)) return Rr({ id: "usrX", email: "rose@example.org", scopes: st.scopes });
      if (/listRecords/.test(url)) return Rr({ records: st.rec ? [st.rec] : [] });
      if (method === "PATCH") return st.failPatch ? Rr({ error: { type: "INVALID", message: "boom" } }, 422) : Rr({ id: st.rec.id, fields: body.fields });
      if (method === "POST") return st.failLog ? Rr({ error: { type: "INVALID", message: "log boom" } }, 422) : Rr({ records: [{ id: "recLOG" }] });
      return Rr({}, 404); } };
  vm.createContext(ctx);
  for (const fl of ["config", "mode", "adapter-airtable", "pricing", "edits", "vendors"]) vm.runInContext(fs.readFileSync(path.join(root, "js", fl + ".js"), "utf8"), ctx);
  const hw = ctx.window; if (cfgOver) Object.assign(hw.REEF_CONFIG, cfgOver);
  const hi = hw.ReefVendors.index({ rates: FX.rates, vendors: FX.vendors, activities: FX.activities });
  const set = (links, extra) => { const raw = Object.assign({ [F.name]: "ZZZ Gate", [F.arrival]: "2027-05-01", [F.students]: 20, [F.chaps]: 5, [F.boatTrips]: 2, [F.approved]: false, [F.propVer]: 1, [F.modified]: "2026-11-02T00:00:00.000Z", [F.pricingRates]: links }, extra || {}); st.rec = { id: "recZZZ0000000001", fields: Object.assign({}, raw) }; return { id: st.rec.id, raw, actNames: ["Boat Snorkel"] }; };
  const writes = () => calls.filter(c => c.method === "PATCH" || (c.method === "POST" && !/listRecords/.test(c.url)));
  const goLive = async () => { hw.ReefData.setToken("pat_TEST"); await hw.ReefData.verify(); return hw.ReefMode.requestLive(); };
  return { hw, st, calls, set, writes, goLive, hi, plan: (b, ch, co) => hw.ReefVendors.plan(b, hi, { choices: ch || {}, counts: co || {} }) };
}
const rejects = async (fn, re) => { try { await fn(); return false; } catch (e) { return re.test(e.message); } };
const LIVE = (o) => Object.assign({ mode: "live", confirmed: true, reason: "Vendor sheet received for 2027", user: "rose@example.org" }, o);
const gate = async (label, re, o) => { o = o || {}; const g = harness(Object.assign({ WRITES_ENABLED: true, WRITES_TEST_RECORDS_ONLY: true }, o.cfg)); const b = g.set(["recR8", "recR10"], o.extra && o.extra.raw); if (o.name) { b.raw[g.hw.REEF_CONFIG.F.name] = o.name; g.st.rec.fields[g.hw.REEF_CONFIG.F.name] = o.name; }
  await g.goLive(); const pl = g.plan(b, o.choices || { snorkel: "recVA|pp" }, o.counts); if (o.setup) await o.setup(g, b, pl);
  const r = await rejects(() => g.hw.ReefVendors.commit(b, o.plan ? o.plan(pl) : pl, LIVE(o.opts)), re); ok(r && g.writes().length === 0, "commit gate: " + label + " throws and sends no write"); };
{
  await gate("not in Live mode", /Not in Live mode/, { setup: g => g.hw.ReefMode.toSandbox("t") });
  await gate("opts.mode is not live", /Not in Live mode/, { opts: { mode: "sandbox" } });
  await gate("not confirmed", /not confirmed/, { opts: { confirmed: "yes" } });
  await gate("reason too short", /reason of at least 10/, { opts: { reason: "short" } });
  await gate("no change in the plan", /Plan is not valid/, { choices: {} });
  await gate("writes disabled", /not switched on/, { setup: g => { g.hw.REEF_CONFIG.WRITES_ENABLED = false; } });
  await gate("non-ZZZ record while test-only is on", /Only ZZZ test records/, { name: "Real School" });
  await gate("record changed since load", /Someone changed this booking/, { setup: g => { g.st.rec.fields[F.modified] = "2026-11-09T00:00:00.000Z"; } });
  await gate("linked rates changed since load", /linked rates changed/, { setup: g => { g.st.rec.fields[F.pricingRates] = ["recR8"]; } });
  await gate("token cannot write", /cannot write/, { setup: g => { g.st.scopes = ["data.records:read"]; return g.hw.ReefData.verify(); } });
  await gate("a required tick box is missing", /tick box/, { extra: { raw: { [F.approved]: true } }, opts: { acks: [] } });
  await gate("a field outside the allowlist", /allowlist/, { plan: pl => Object.assign({}, pl, { fields: Object.assign({}, pl.fields, { [F.total]: 1 }) }) });
  await gate("a field outside the allowlist (Proposal Version)", /allowlist/, { plan: pl => Object.assign({}, pl, { fields: { [F.propVer]: 9 } }) });
  await gate("Pricing Rates that are not record IDs", /record IDs/, { plan: pl => Object.assign({}, pl, { fields: { [F.pricingRates]: ["Pirates"] } }) });
}
let g = harness({ WRITES_ENABLED: true }), gb = g.set(["recR8", "recR10", "recR9"]); await g.goLive();
let gp = g.plan(gb, { snorkel: "recVA|pp" }, { divers: "12" });
let gr = await g.hw.ReefVendors.commit(gb, gp, LIVE());
const W = g.writes(), pt = W.find(c => c.method === "PATCH"), lg = W.find(c => c.method === "POST");
ok(W.length === 2 && gr.saved && gr.logOk, "commit: exactly one PATCH and one log row");
ok(pt.body.typecast === false && JSON.stringify(Object.keys(pt.body.fields).sort()) === JSON.stringify([F.pricingRates, F.divers].sort()) && JSON.stringify(pt.body.fields[F.pricingRates]) === '["recR1"]' && pt.body.fields[F.divers] === 12, "commit: PATCH sends the full Pricing Rates array and # Divers, nothing else, typecast false");
ok(pt.url.endsWith("/" + C.T.bookings + "/recZZZ0000000001"), "commit: the PATCH goes to the one booking");
const lf = lg.body.records[0].fields, XC = g.hw.ReefData.FX.comms;
ok(lf[XC.what] === "Other" && lf[XC.summary] === "App edit: Pricing Rates, # Divers" && lf[XC.booking][0] === gb.id && /Reason: Vendor sheet received for 2027/.test(lf[XC.details]) && /Pricing Rates: bravo_snorkel_half_day_charter_2027, bravo_snorkel_gear_2027, bravo_snorkel_capacity -> alpha_snorkel_pp_2027/.test(lf[XC.details]) && /# Divers: \(blank\) -> 12/.test(lf[XC.details]) && /Edited by: rose@example\.org/.test(lf[XC.details]), "change log: Communications Log row with who, before and after, and the reason");
g = harness({ WRITES_ENABLED: true }); gb = g.set(["recR8"]); await g.goLive(); g.st.failLog = true;
gr = await g.hw.ReefVendors.commit(gb, g.plan(gb, { snorkel: "recVA|pp" }), LIVE());
ok(gr.saved && !gr.logOk && /log boom/.test(gr.logError) && /Reason: Vendor sheet/.test(gr.log.details), "partial failure: PATCH ok but log fails reports it with the exact log text to copy");
g = harness({ WRITES_ENABLED: true }); gb = g.set(["recR8"]); await g.goLive(); g.st.failPatch = true;
ok(await rejects(() => g.hw.ReefVendors.commit(gb, g.plan(gb, { snorkel: "recVA|pp" }), LIVE()), /Airtable 422/) && g.writes().length === 1, "partial failure: PATCH fails, the error surfaces and no log row is written");
g = harness({ WRITES_ENABLED: true }); gb = g.set([], { [F.approved]: true }); await g.goLive();
gr = await g.hw.ReefVendors.commit(gb, g.plan(gb, { snorkel: "recVD|pp" }), LIVE({ acks: ["approve"] })); ok(gr.saved && g.writes().length === 2, "commit: an approved booking saves once its un-approve tick is given");
g = harness({ WRITES_ENABLED: true }); gb = g.set([], { [F.approved]: true }); await g.goLive();
gr = await g.hw.ReefVendors.commit(gb, g.plan(gb, {}, { divers: "4" }), LIVE()); ok(gr.saved && JSON.stringify(Object.keys(g.writes()[0].body.fields)) === JSON.stringify([F.divers]), "commit: a counts-only save on an approved booking needs no un-approve tick and writes only # Divers");
ok(/typecast:\s*false/.test(fs.readFileSync(path.join(root, "js/adapter-airtable.js"), "utf8")) && !/_patch|_create|fetch\(/.test(fs.readFileSync(path.join(root, "js/vendors.js"), "utf8").replace(/D\._patch\(C\.T\.bookings, booking\.id, p\.fields\)/, "")), "vendors.js has no second write path (its only write is the shared D._patch, and it never calls fetch)");


  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log("FAIL unexpected error: " + e.stack); process.exit(1); });
