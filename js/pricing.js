/* PRICING MIRROR (read-only reference). Copies the CURRENT Airtable formulas so the page can show what-if effects.
   NOT the source of truth: for every booking the page compares this to Airtable's stored Total Package Price and says
   whether they match. Policy constants come from the Rates table at runtime (Booking Vendor Lines, planned, will replace them).
   Change prices in Airtable, never here. */
window.ReefPricing = (function () {
  /* No rates are stored in this file. They are read from the live Rates table (by Rate Key) after the user connects. */
  const KEYS = { programFullDay: "reef_program_fee_full_day", programArrDep: "reef_program_fee_arr_dep_day", supplies: "reef_supplies_per_participant", campusSession: "reef_campus_facility_half_day",
    uplift: "policy_uplift_pct", boatRate: "oceanfirst_boat_halfday", boatCap: "oceanfirst_boat_snorkel_cap", vessels: "oceanfirst_boats_available", gear: "oceanfirst_snorkel_gear", gratuity: "oceanfirst_boat_gratuity",
    kayakDouble: "reef_double_kayak", kayakSingle: "reef_single_kayak", paddleDouble: "paddle_double_kayak", paddleStaff: "paddle_staff_kayak",
    entrance: "pennekamp_entrance", paxPerVehicle: "pennekamp_pax_per_vehicle", staffKayaks: "policy_default_staff_kayaks", busEntrance: "pennekamp_entrance_bus", freeChapPer: "policy_free_chap_threshold" };
  /* Optional keys: absent is fine. pennGearIncluded: 1 = snorkel gear is part of the Pennekamp boat fee (Martha 2026-11-05). */
  const OPT = { pennGearIncluded: "pennekamp_boat_includes_snorkel_gear", moteFee: "mote_activity_fee" };
  const R = {}; let ready = false;
  function load(rateRows) {
    const X = window.ReefData.FX.rates, byKey = {};
    rateRows.forEach(r => { const k = r.fields[X.key]; if (k) byKey[k] = r.fields[X.cur] != null ? r.fields[X.cur] : r.fields[X.num]; });
    const missing = [];
    Object.keys(KEYS).forEach(n => { const v = byKey[KEYS[n]]; if (typeof v === "number") R[n] = v; else missing.push(KEYS[n]); });
    Object.keys(OPT).forEach(n => { const v = byKey[OPT[n]]; if (typeof v === "number") R[n] = v; else delete R[n]; });
    ready = missing.length === 0; return { ready, missing };
  }

  /* i: {students, chaps, staff, days, arrDays, sessions, trips, buses, discountPct, upliftPct, taxExempt, addVendor, materials}
     v: vendor scenario {capacity, rate, vessels, gear, grat} (null fields = not on file => incomplete) */
  const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
  /* Kayak vendor changed to Paddle the Florida Keys. Airtable's vendor formula uses the new double rate only when CREATED_TIME() is
     after 2026-11-10, so earlier bookings keep the Pennekamp concession rates. An unknown created time is treated as earlier. */
  const PADDLE_AFTER = "2026-11-10";
  const paddleRates = i => !!i.created && Date.parse(i.created) > Date.parse(PADDLE_AFTER);
  const hasAct = (i, s) => String(i.acts || "").indexOf(s) >= 0;
  /* Snorkel gear is included in the Pennekamp boat fee (Martha 2026-11-05). Airtable's auto vendor formula still adds gear, so the
     baseline mirror follows Airtable and only the read-only vendor scenario drops it. Rates key pennekamp_boat_includes_snorkel_gear
     (1/0) overrides when present. */
  function gearIncluded(i) { const pen = hasAct(i, "Pennekamp") || i.buses > 0; return R.pennGearIncluded != null ? (R.pennGearIncluded > 0 && pen) : pen; }
  /* Mirrors Airtable's stored formulas (read 2026-11-09): Subtotal = manual vendor estimate + program fees + supplies + campus + Pennekamp
     + gratuities + auto vendors (only when manual is blank) + additional vendor costs. Uplift on subtotal; discount % of subtotal.
     i: {students, chaps, staff, days, arrDays, sessions, trips, buses, discountPct, upliftPct, addVendor, manualVendor, acts, model, status, arrival, freeChapOverride, taxExempt, type}
     v: vendor scenario {capacity, rate, vessels, gear, grat} (null = not on file => incomplete)
     Shapes the mirror does not model are reported in `unsupported`; the page then says "mirror out of date, use Airtable's figure". */
  function calc(i, v) {
    if (!ready) throw new Error("Pricing constants not loaded from the Rates table");
    v = v || {};
    const model = String(i.model || ""), discovery = model.indexOf("Discovery") >= 0, legacy = model === "Legacy (completed)";
    const unsupported = [];
    if (discovery) unsupported.push("Discovery pricing model");
    if (legacy) unsupported.push("Legacy (completed) pricing");
    if (/completed/i.test(i.status || "") || (i.arrival && String(i.arrival).slice(0, 10) < "2026-09-25")) unsupported.push("pre-2026-09-25 program fee rate");
    if (hasAct(i, "Glass-Bottom")) unsupported.push("Glass-Bottom boat pricing");
    if (i.type === "Facility Rental") unsupported.push("Facility Rental tax");
    const people = i.students + i.chaps, aboard = people + i.staff, trips = i.trips > 0 ? i.trips : 1;
    const thr = i.freeChapOverride != null ? i.freeChapOverride : R.freeChapPer;
    const freeChap = Math.min(i.chaps, Math.floor(people / thr)), paid = people - freeChap;
    const prog = paid * i.days * R.programFullDay + paid * i.arrDays * R.programArrDep;
    const sup = paid * R.supplies, camp = i.sessions * R.campusSession;
    const cap = v.capacity == null ? R.boatCap : +v.capacity, rate = v.rate === undefined ? R.boatRate : v.rate;
    const gear = v.gear === undefined ? R.gear : v.gear, grat = v.grat === undefined ? R.gratuity : v.grat;
    const incomplete = [];
    if (!cap) incomplete.push("capacity per vessel"); if (rate == null || rate === "") incomplete.push("quote per departure");
    if (gear == null || gear === "") incomplete.push("snorkel gear $/person"); if (grat == null || grat === "") incomplete.push("gratuity $/person");
    const boatAct = hasAct(i, "Boat Snorkel"), snork = boatAct || hasAct(i, "Shore Snorkel"), kayakAct = hasAct(i, "Kayaking");
    const perBoat = cap ? Math.ceil(aboard / cap) : 0, departures = boatAct ? perBoat * trips : 0;
    const vessels = v.vessels == null || v.vessels === "" ? null : +v.vessels, waves = vessels ? Math.ceil(departures / vessels) : null;
    const boats = departures * (+rate || 0), gearC = snork ? people * (+gear || 0) : 0;
    const pad = paddleRates(i), kDouble = pad ? R.paddleDouble : R.kayakDouble, kStaff = pad ? R.paddleStaff : R.kayakSingle;
    const kayaks = kayakAct ? Math.ceil(people / 2) * kDouble + R.staffKayaks * kStaff : 0;
    const autoV = discovery || legacy ? 0 : boats + gearC + kayaks;
    const manual = i.manualVendor != null && i.manualVendor > 0;
    let vendors = autoV;
    if (manual) { const a0 = boatAct ? Math.ceil(aboard / R.boatCap) * trips * R.boatRate : 0; vendors = i.manualVendor + (autoV - (a0 + (snork ? people * (v.baseGear === undefined ? R.gear : v.baseGear) : 0) + kayaks)); } // scenario relative to the manual estimate
    const gr = !legacy && (boatAct || hasAct(i, "Boat Dive")) ? aboard * trips * (+grat || 0) : 0;
    /* Airtable: Pennekamp program, not Legacy: buses x bus rate when a bus count is entered, else vehicles (CEILING(people / 6)) x $8. */
    const vehicles = hasAct(i, "Pennekamp") && !legacy && !(i.buses > 0) ? Math.ceil(people / R.paxPerVehicle) : 0;
    const penn = hasAct(i, "Pennekamp") && !legacy ? (i.buses > 0 ? i.buses * R.busEntrance : vehicles * R.entrance) : 0, addV = i.addVendor || 0;
    const vendorsLine = vendors + gr + addV;
    const sub = prog + sup + camp + penn + vendorsLine;
    const upl = sub * (i.upliftPct == null ? R.uplift : i.upliftPct), disc = sub * (i.discountPct || 0);
    const total = r2(sub + upl - disc);
    return { people, freeChap, paid, aboard, prog, sup, camp, perBoat, departures, vessels, waves, cap, rate: +rate || 0, boats, gearC, gearIncluded: gearIncluded(i), kayaks, vehicles, manual, vendors, vendorsLine, penn, gr, addV, sub, upl, disc, total, incomplete, unsupported, supported: unsupported.length === 0 };
  }
  return { R, calc, load, isReady: () => ready };
})();
