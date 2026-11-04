/* PRICING MIRROR (read-only reference). Copies the CURRENT Airtable formulas so the page can show what-if effects.
   NOT the source of truth: for every booking the page compares this to Airtable's stored Total Package Price and says
   whether they match. Policy constants come from the Rates table at runtime (Booking Vendor Lines, planned, will replace them).
   Change prices in Airtable, never here. */
window.ReefPricing = (function () {
  /* No rates are stored in this file. They are read from the live Rates table (by Rate Key) after the user connects. */
  const KEYS = { programFullDay: "reef_program_fee_full_day", programArrDep: "reef_program_fee_arr_dep_day", supplies: "reef_supplies_per_participant", campusSession: "reef_campus_facility_half_day",
    uplift: "policy_uplift_pct", boatRate: "oceanfirst_boat_halfday", boatCap: "oceanfirst_boat_snorkel_cap", vessels: "oceanfirst_boats_available", gear: "oceanfirst_snorkel_gear", gratuity: "oceanfirst_boat_gratuity",
    kayakDouble: "reef_double_kayak", kayakSingle: "reef_single_kayak", staffKayaks: "policy_default_staff_kayaks", busEntrance: "pennekamp_entrance_bus", freeChapPer: "policy_free_chap_threshold" };
  const R = {}; let ready = false;
  function load(rateRows) {
    const X = window.ReefData.FX.rates, byKey = {};
    rateRows.forEach(r => { const k = r.fields[X.key]; if (k) byKey[k] = r.fields[X.cur] != null ? r.fields[X.cur] : r.fields[X.num]; });
    const missing = [];
    Object.keys(KEYS).forEach(n => { const v = byKey[KEYS[n]]; if (typeof v === "number") R[n] = v; else missing.push(KEYS[n]); });
    ready = missing.length === 0; return { ready, missing };
  }

  /* i: {students, chaps, staff, days, arrDays, sessions, trips, buses, discountPct, upliftPct, taxExempt, addVendor, materials}
     v: vendor scenario {capacity, rate, vessels, gear, grat} (null fields = not on file => incomplete) */
  function calc(i, v) {
    if (!ready) throw new Error("Pricing constants not loaded from the Rates table");
    v = v || {};
    const people = i.students + i.chaps;
    const freeChap = Math.floor(people / R.freeChapPer), paid = people - freeChap;
    const aboard = people + i.staff;
    const prog = paid * i.days * R.programFullDay + paid * i.arrDays * R.programArrDep;
    const sup = paid * R.supplies, camp = i.sessions * R.campusSession;
    const cap = v.capacity == null ? R.boatCap : +v.capacity, rate = v.rate === undefined ? R.boatRate : v.rate;
    const gear = v.gear === undefined ? R.gear : v.gear, grat = v.grat === undefined ? R.gratuity : v.grat;
    const incomplete = [];
    if (!cap) incomplete.push("capacity per vessel"); if (rate == null || rate === "") incomplete.push("quote per departure");
    if (gear == null || gear === "") incomplete.push("snorkel gear $/person"); if (grat == null || grat === "") incomplete.push("gratuity $/person");
    const perBoat = cap ? Math.ceil(aboard / cap) : 0;
    const departures = perBoat * (i.trips || 0);                 // boat departures that must be paid for
    const vessels = v.vessels == null || v.vessels === "" ? null : +v.vessels;
    const waves = vessels ? Math.ceil(departures / vessels) : null; // sequential sailing windows needed with the vessels available
    const boats = departures * (+rate || 0);
    const gearC = people * (+gear || 0);
    const kayaks = Math.ceil(people / 2) * R.kayakDouble + R.staffKayaks * R.kayakSingle;
    const vendors = boats + gearC + kayaks;
    const penn = i.buses * R.busEntrance, gr = aboard * (i.trips || 0) * (+grat || 0);
    const addV = i.addVendor || 0, mat = i.materials || 0;
    const sub = prog + sup + camp + vendors + penn + gr + addV + mat;
    const upl = sub * (i.upliftPct == null ? R.uplift : i.upliftPct);
    const disc = (sub + upl) * (i.discountPct || 0);
    const total = sub + upl - disc;
    return { people, freeChap, paid, aboard, prog, sup, camp, perBoat, departures, vessels, waves, cap, rate: +rate || 0, boats, gearC, kayaks, vendors, penn, gr, addV, mat, sub, upl, disc, total, incomplete };
  }
  return { R, calc, load, isReady: () => ready };
})();
