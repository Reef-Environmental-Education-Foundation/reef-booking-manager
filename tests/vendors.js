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

module.exports = { w, V, idx, FX, ok, results: () => ({ pass, fail }) };
if (require.main === module) { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
