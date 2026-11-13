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

module.exports = { w, V, idx, FX, ok, results: () => ({ pass, fail }) };
if (require.main === module) { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
