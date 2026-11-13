/* VENDOR AND RATE PICKER (logic). DOM-free so it can be tested on its own.
   Rose picks the vendor for each activity on a booking; the chosen vendor's Rates records are written to the booking's
   "Pricing Rates" link. Precedent: js/contract.js (own one-purpose write allowlist, shared guarded write path and change log).
   Nothing here reads a rate, vendor name or price from this file: everything comes from the Rates, Vendors and Activities tables at runtime.
   Pricing Rates is a LINK field and is deliberately NOT in config EDITABLE. Airtable's rollups take the HIGHEST linked rate within a
   kind (for example two snorkel_pp rates price at the higher one), so the picker REPLACES within a category and never adds a second vendor. */
window.ReefVendors = (function () {
  const C = window.REEF_CONFIG, F = C.F, VP = C.VENDOR_PICKER;
  const ALLOWLIST = VP.WRITE_FIELDS;   // the whole write allowlist for this feature. Approval, Proposal Version, Contract Status and money fields are NOT here.
  const FXR = () => window.ReefData.FX.rates;
  const txt = v => v && typeof v === "object" && !Array.isArray(v) ? (v.name || "") : (Array.isArray(v) ? v.map(txt).join(", ") : (v == null ? "" : String(v)));
  const num = v => typeof v === "number" && isFinite(v) ? v : null;
  const dateOnly = d => d ? String(d).slice(0, 10) : null;

  /* The picker's categories. "needs" = a requested activity that calls for this category. */
  const SLOTS = [
    { id: "snorkel", label: "Boat snorkel", needs: /boat snorkel/i },
    { id: "dive", label: "Boat dive", needs: /boat dive|scuba|\bdive\b/i },
    { id: "gear", label: "Gear rental", needs: /boat snorkel|boat dive|scuba|\bdive\b/i },
    { id: "kayak", label: "Kayaks", needs: /kayak/i },
    { id: "penn", label: "Pennekamp", needs: /pennekamp/i }
  ];
  const SLOT_LABEL = { snorkel: "Boat snorkel", dive: "Boat dive", gear: "Gear rental", kayak: "Kayaks", penn: "Pennekamp", capacity: "Capacity records", other: "Other rates (not changed by the picker)" };
  const SERVICE_WORDS = new Set(["snorkel", "dive", "capacity", "gbb", "glass", "gear", "kayak"]);

  /* ---------- rate model ---------- */
  /* Rate Key pattern: <vendor>_<service>_<kind>_<year>. Read the service words from the key, ignoring leading words that are just the vendor's name
     (a vendor called "Key Dives" has the word "dive(s)" in every key). If stripping the vendor words leaves no service word, use the whole key. */
  function keyInfo(key, vendorName) {
    const t = String(key || "").toLowerCase().split("_").filter(Boolean);
    const vn = new Set(String(vendorName || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
    let i = 0; while (i < t.length && vn.has(t[i])) i++;
    const stripped = t.slice(i), use = stripped.some(w => SERVICE_WORDS.has(w)) ? stripped : t;
    const has = w => use.includes(w);
    return { tokens: t, snorkel: has("snorkel"), dive: has("dive"), capacity: has("capacity"), gbb: has("gbb") || has("glass"), gear: has("gear"), pp: t.includes("pp") };
  }
  const stemOf = key => String(key || "").toLowerCase().replace(/_(?:19|20)\d\d(?:_[a-z]+)?$/, "");

  function classify(r) {
    const k = keyInfo(r.key, r.vendorName), cat = r.cat, unit = r.unit || "";
    if (k.capacity) return { slot: "capacity", svc: k.dive && !k.snorkel ? "dive" : k.snorkel ? "snorkel" : null, model: "set", k };
    if (cat === "Boats") {
      if (k.gbb) return { slot: "other", model: "set", k };
      const acts = r.activityNames.join(" ");
      if (k.dive && !k.snorkel) return { slot: "dive", model: "set", k };
      if (k.snorkel) return { slot: "snorkel", model: k.pp ? "pp" : "boat", k };
      if (/dive/i.test(acts) && !/snorkel/i.test(acts)) return { slot: "dive", model: "set", k };
      if (/snorkel/i.test(acts)) return { slot: "snorkel", model: k.pp ? "pp" : "boat", k };
      if (/\/boat\//.test(unit)) return { slot: "snorkel", model: "boat", k };   // older per-boat charter keys carry no service word
      return { slot: "other", model: "set", k };
    }
    if (cat === "Gear Rental") return { slot: "gear", model: "set", k };
    if (cat === "Kayaks") return { slot: "kayak", model: "set", k };
    if (cat === "Pennekamp") return { slot: "penn", model: "set", k };
    return { slot: "other", model: "set", k };
  }

  /* vd: {rates, vendors, activities} as read by ReefData.loadVendorData(). Returns the working index. */
  function index(vd) {
    const X = FXR(), XV = window.ReefData.FX.vendors, XA = window.ReefData.FX.activities;
    vd = vd || {}; const vname = {}, aname = {};
    (vd.vendors || []).forEach(v => { vname[v.id] = v.fields[XV.name]; });
    (vd.activities || []).forEach(a => { aname[a.id] = a.fields[XA.name]; });
    const rates = (vd.rates || []).map(rec => {
      const f = rec.fields, vendorId = (f[X.vendor] || [])[0] || "";
      const r = { id: rec.id, key: String(f[X.key] || ""), name: f[X.name] || f[X.key] || rec.id, cat: txt(f[X.cat]), vendorId,
        vendorName: vname[vendorId] || txt(f[X.vendorName]) || "", value: num(f[X.cur]) != null ? num(f[X.cur]) : num(f[X.num]), unit: txt(f[X.unit]),
        eff: dateOnly(f[X.eff]), active: !!f[X.active], notes: String(f[X.notes] || ""), status: txt(f[X.status]), avail: txt(f[X.avail]),
        activityNames: (f[X.activities] || []).map(id => aname[id] || "") };
      const c = classify(r); r.slot = c.slot; r.model = c.model; r.svc = c.svc || null; r.k = c.k; r.stem = stemOf(r.key);
      r.pending = /pending/i.test(r.status); r.placeholder = /placeholder/i.test(r.status); r.unavailable = /not available/i.test(r.avail); r.confirmBefore = /confirm before/i.test(r.avail);
      return r;
    });
    const byId = {}; rates.forEach(r => { byId[r.id] = r; });
    return { rates, byId };
  }

  /* Hidden from the picker entirely: Placeholder - Not Real, and Availability Not Available. The Active checkbox is NOT used (2027 rates are Active off). */
  const hidden = r => r.placeholder || r.unavailable;

  /* For one group of rates with the same stem (same kind of rate across years): the newest with Effective Date on or before arrival.
     If every one is dated after arrival, the earliest of those, flagged so the page can say "rate sheet dated <date>, after this arrival". */
  function pickPerStem(list, arrival) {
    const by = {}; list.forEach(r => (by[r.stem] = by[r.stem] || []).push(r));
    const out = [];
    Object.keys(by).sort().forEach(stem => {
      const g = by[stem].slice().sort((a, b) => String(b.eff || "").localeCompare(String(a.eff || "")));   // newest first, undated last
      let pick = arrival ? g.find(r => !r.eff || r.eff <= arrival) : g[0], after = false;
      if (!pick) { pick = g[g.length - 1]; after = true; }
      out.push(Object.assign({}, pick, { afterArrival: after && !!arrival }));
    });
    return out;
  }

  /* Capacity per vendor, from <vendor>_snorkel_capacity and <vendor>_dive_capacity (value in Rate Value Number, unit passengers). Lowest wins if duplicated. */
  function capacityOf(idx, vendorId) {
    const cap = { snorkel: null, dive: null };
    idx.rates.forEach(r => {
      if (r.slot !== "capacity" || r.vendorId !== vendorId || r.placeholder || r.value == null || !r.svc) return;
      cap[r.svc] = cap[r.svc] == null ? r.value : Math.min(cap[r.svc], r.value);
    });
    return cap;
  }

  /* Dropdown options for one category: one per vendor (and per pricing model where a vendor has both per-person and per-boat snorkel rates). */
  function options(idx, slot, arrival) {
    const groups = {};
    idx.rates.filter(r => r.slot === slot && !hidden(r)).forEach(r => { const id = (r.vendorId || "none") + "|" + r.model; (groups[id] = groups[id] || []).push(r); });
    const out = Object.keys(groups).map(id => {
      const first = groups[id][0];
      // snorkel: one record per pricing model (a vendor's older and newer per-boat keys are the same kind of rate, and Airtable would take the higher)
      const rs = pickPerStem(slot === "snorkel" ? groups[id].map(r => Object.assign({}, r, { stem: "snorkel-" + r.model })) : groups[id], arrival);
      const notes = []; rs.forEach(r => { if (r.notes && !notes.includes(r.notes)) notes.push(r.notes); });
      return { id, slot, vendorId: first.vendorId, vendorName: first.vendorName || "(no vendor on the rate)", model: first.model, rates: rs,
        afterArrival: rs.some(r => r.afterArrival), pending: rs.some(r => r.pending), confirmBefore: rs.some(r => r.confirmBefore),
        needsRenegotiation: rs.some(r => /renegotiat/i.test(r.status)), notes, capacity: capacityOf(idx, first.vendorId) };
    });
    return out.filter(o => o.rates.length).sort((a, b) => a.vendorName.localeCompare(b.vendorName) || a.model.localeCompare(b.model));
  }
  const modelLabel = m => m === "pp" ? "per person" : m === "boat" ? "per boat charter" : "";
  const optionLabel = o => o.vendorName + (o.slot === "snorkel" && modelLabel(o.model) ? " (" + modelLabel(o.model) + ")" : "");

  /* ---------- what the booking has now ---------- */
  const linked = b => [].concat((b.raw || {})[F.pricingRates] || []).filter(x => typeof x === "string");
  /* Group the currently linked rate records by category. Records the picker does not know (not in the Rates read) are kept as "unknown". */
  function current(b, idx) {
    const ids = linked(b), by = {}, unknown = [];
    SLOTS.map(s => s.id).concat(["capacity", "other"]).forEach(s => { by[s] = []; });
    ids.forEach(id => { const r = idx.byId[id]; if (!r) unknown.push(id); else by[r.slot].push(r); });
    return { ids, by, unknown };
  }
  /* The option that best matches what is linked now (most records in common), or null. */
  function matchOption(opts, rates) {
    let best = null, bestN = 0; const have = new Set(rates.map(r => r.id));
    opts.forEach(o => { const n = o.rates.filter(r => have.has(r.id)).length; if (n > bestN) { best = o; bestN = n; } });
    return best ? { option: best, exact: best.rates.length === have.size && bestN === have.size } : null;
  }
  /* Airtable prices at the highest linked rate of a kind, so two vendors in one category silently price at the higher one. */
  function conflicts(cur) {
    const out = [];
    ["snorkel", "dive", "gear", "kayak", "penn"].forEach(s => {
      const v = {}; cur.by[s].forEach(r => { v[r.vendorId || "none"] = r.vendorName || "(no vendor)"; });
      const names = Object.keys(v).map(k => v[k]); if (names.length > 1) out.push({ slot: s, vendors: names });
    });
    return out;
  }
  /* Categories this booking needs: from its requested activities, plus any category that already has linked records. */
  function neededSlots(b, cur) {
    const acts = (b.actNames || []).join(", ");
    return SLOTS.filter(s => s.needs.test(acts) || cur.by[s.id].length).map(s => s.id);
  }

  return { SLOTS, SLOT_LABEL, ALLOWLIST, index, classify, keyInfo, stemOf, hidden, pickPerStem, capacityOf, options, optionLabel, modelLabel, linked, current, matchOption, conflicts, neededSlots };
})();
