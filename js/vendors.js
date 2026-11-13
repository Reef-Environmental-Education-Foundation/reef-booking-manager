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
     (a vendor whose name contains "dive" has that word in every key). If stripping the vendor words leaves no service word, use the whole key. */
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


  /* ---------- the change plan (never writes) ---------- */
  const show = v => v === null || v === undefined || v === "" ? "(blank)" : String(v);
  const keyName = (idx, id) => (idx.byId[id] && idx.byId[id].key) || id;
  /* The dropdown value that stands for "what is linked now": the exact matching option, a marker for linked records that are not a picker set, or none. */
  function initialChoice(idx, cur, slot, arrival) {
    const m = matchOption(options(idx, slot, arrival), cur.by[slot]);
    return m && m.exact ? m.option.id : (cur.by[slot].length ? "__current" : "none");
  }
  const parseCount = raw => { if (raw === null || raw === undefined || String(raw).trim() === "") return { blank: true, value: null }; const t = String(raw).trim(); return /^\d+$/.test(t) ? { blank: false, value: +t } : { blank: false, value: null, bad: true }; };

  /* b: booking model ({raw, actNames}). o: {choices: {slot: optionId|"none"}, counts: {divers, snorkelers} raw strings, baseModified}.
     choices a slot is absent from, or set to what is linked now, leave that category alone. Selecting REPLACES the old records of that category and
     never touches records of other categories (except the leftovers of a per-boat/per-person switch, listed separately). */
  function plan(b, idx, o) {
    o = o || {}; const raw = b.raw, arrival = dateOnly(raw[F.arrival]), cur = current(b, idx), choices = o.choices || {}, counts = o.counts || {};
    const errors = {}, fields = {}, diff = [], remove = new Set(), add = [], changedSlots = []; let leftover = [], switched = null;
    SLOTS.forEach(sl => {
      const ch = choices[sl.id]; if (ch === undefined || ch === initialChoice(idx, cur, sl.id, arrival) || ch === "__current") return;
      const chosen = ch === "none" ? null : options(idx, sl.id, arrival).find(x => x.id === ch);
      if (ch !== "none" && !chosen) { errors[sl.id] = "That vendor choice is not available for this booking"; return; }
      changedSlots.push(sl.id); cur.by[sl.id].forEach(r => remove.add(r.id)); if (chosen) chosen.rates.forEach(r => add.push(r));
      if (sl.id === "snorkel") {
        const oldModel = cur.by.snorkel.some(r => r.model === "pp") ? "pp" : (cur.by.snorkel.length ? "boat" : null), newModel = chosen ? chosen.model : null;
        if (oldModel && newModel && oldModel !== newModel) {
          switched = { from: oldModel, to: newModel }; leftover = cur.by.snorkel.slice();
          if (newModel === "pp") {   // per-person pricing does not use the per-boat charter + gear + capacity records
            cur.by.gear.filter(r => r.k.snorkel).concat(cur.by.capacity.filter(r => r.svc === "snorkel")).forEach(r => { remove.add(r.id); leftover.push(r); });
          }
        }
      }
    });
    const addIds = add.map(r => r.id), after = cur.ids.filter(id => !remove.has(id));
    addIds.forEach(id => { if (!after.includes(id)) after.push(id); });   // no duplicates
    const sorted = a => a.slice().sort().join(), changedRates = sorted(after) !== sorted(cur.ids);
    if (changedRates) {
      fields[F.pricingRates] = after;
      diff.push({ key: "pricingRates", label: "Pricing Rates", before: cur.ids.length ? cur.ids.map(i => keyName(idx, i)).join(", ") : null, after: after.length ? after.map(i => keyName(idx, i)).join(", ") : null });
    }
    ["divers", "snorkelers"].forEach(k => {
      if (counts[k] === undefined) return;
      const spec = VP.COUNTS[k], r = window.ReefEdits.validateField(k, counts[k], { type: "int", min: spec.min, max: spec.max, required: false });
      if (!r.ok) { errors[k] = r.err; return; }
      const before = raw[F[k]] === undefined ? null : raw[F[k]]; if (show(before) === show(r.value)) return;
      diff.push({ key: k, label: spec.label, before, after: r.value }); fields[F[k]] = r.value;
    });
    // approvals and warnings
    const approved = !!raw[F.approved], propVer = raw[F.propVer] || 0, status = txt(raw[F.status]), agree = txt(raw[F.agreementStatus]);
    const unapproves = approved && changedRates, legacy = txt(raw[F.pricingModel]) === "Legacy (completed)" || /completed/i.test(status), locked = legacy || /^(sent|signed)$/i.test(agree) || /signed/i.test(status);
    const name = String(raw[F.name] || ""), test = name.startsWith(C.TEST_PREFIX), pendingAdded = add.filter(r => r.pending);
    const warnings = [], acks = [];
    if (unapproves) { warnings.push("Saving will un-approve this proposal, bump the Proposal Version and alert Martha in Slack; the live page stays up until re-approved and republished."); acks.push({ id: "approve", label: "I understand this un-approves the proposal" }); }
    if (locked && diff.length) {
      const why = [legacy ? "Legacy (completed)" : "", /^(sent|signed)$/i.test(agree) ? "Contract Status " + agree : "", /signed/i.test(status) && !/^signed$/i.test(agree) ? "Status " + status : ""].filter(Boolean).join(", ");
      warnings.push("This booking is " + why + ". Changing its vendors can change what was already agreed or finished.");
      acks.push({ id: "locked", label: "I understand this booking is " + why + " and I still want to change it" });
    }
    if (pendingAdded.length && !test) { warnings.push("Pending vendor confirmation: " + pendingAdded.map(r => r.key).join(", ") + ". The vendor has not confirmed these rates."); acks.push({ id: "pending", label: "I understand these rates are pending vendor confirmation" }); }
    else if (pendingAdded.length) warnings.push("Pending vendor confirmation (test record, no tick needed): " + pendingAdded.map(r => r.key).join(", ") + ".");
    const writeBlockedBy = !C.WRITES_ENABLED ? "Live editing is not switched on yet" : (C.WRITES_TEST_RECORDS_ONLY && !test ? "Only " + C.TEST_PREFIX + " test records may be saved live right now" : null);
    return { ok: Object.keys(errors).length === 0 && diff.length > 0, errors, diff, fields, warnings, acks, ack: { needed: acks.length > 0 }, changedRates, changedSlots, switched, leftover,
      links: { before: cur.ids, after, added: add, removed: cur.ids.filter(id => remove.has(id)).map(id => idx.byId[id] || { id, key: id }) },
      approved, unapproves, propVer, propVerKnown: raw[F.propVer] != null, predicted: { approved: unapproves ? false : approved, propVer: unapproves ? propVer + 1 : propVer },
      isTestRecord: test, writeBlockedBy, baseModified: o.baseModified !== undefined ? o.baseModified : (raw[F.modified] || null), pendingAdded };
  }

  /* ---------- capacity checks (warnings only, they never block saving) ---------- */
  function capacity(b, idx, ids, counts) {
    counts = counts || {}; const raw = b.raw, out = [], rs = ids.map(i => idx.byId[i]).filter(Boolean);
    const sr = rs.find(r => r.slot === "snorkel"), dr = rs.find(r => r.slot === "dive"), acts = (b.actNames || []).join(", ");
    const students = +raw[F.students] || 0, chaps = +raw[F.chaps] || 0, people = students + chaps, trips = +raw[F.boatTrips] || 0;
    const cnt = k => parseCount(counts[k] !== undefined ? counts[k] : raw[F[k]]), dv = cnt("divers"), sk = cnt("snorkelers");
    const snorkelers = sk.value != null ? sk.value : people, assumed = sk.value == null;
    const wantsSnorkel = !!sr || /boat snorkel/i.test(acts), wantsDive = !!dr || (dv.value || 0) > 0;
    const add = (level, text, kind) => out.push({ level, text, kind });
    const sCap = sr ? capacityOf(idx, sr.vendorId).snorkel : null, dCap = dr ? capacityOf(idx, dr.vendorId).dive : null;
    let checked = false;
    if (wantsSnorkel && snorkelers > 0) {
      if (assumed) add("info", "# Snorkelers is blank, so students + chaperones (" + people + ") are used as the snorkeler count.", "assumed");
      if (!sr) add("info", "No snorkel vendor is chosen yet, so snorkel capacity cannot be checked.", "none");
      else if (sCap == null) add("amber", sr.vendorName + ": snorkel capacity not on file. Call the vendor.", "snorkel-nocap");
      else { checked = true; if (snorkelers > sCap) add("amber", "Snorkelers (" + snorkelers + ") are over " + sr.vendorName + "'s snorkel capacity of " + sCap + ".", "snorkel-over"); else add("ok", "Snorkelers (" + snorkelers + ") fit " + sr.vendorName + "'s snorkel capacity of " + sCap + ".", "snorkel-ok"); }
    }
    if (wantsDive && (dv.value || 0) > 0) {
      if (!dr) add("info", "# Divers is " + dv.value + " but no dive vendor is chosen yet, so dive capacity cannot be checked.", "none");
      else if (dCap == null) add("amber", dr.vendorName + ": dive capacity not on file. Call the vendor.", "dive-nocap");
      else { checked = true; if (dv.value > dCap) add("amber", "Divers (" + dv.value + ") are over " + dr.vendorName + "'s dive capacity of " + dCap + ".", "dive-over"); else add("ok", "Divers (" + dv.value + ") fit " + dr.vendorName + "'s dive capacity of " + dCap + ".", "dive-ok"); }
    } else if (dr && dv.blank) add("info", "# Divers is not set, so dive capacity cannot be checked.", "none");
    // mixed group: both counts set explicitly
    if (sk.value > 0 && dv.value > 0) {
      const total = sk.value + dv.value;
      if (!sr || !dr) add("info", "Mixed group (" + sk.value + " snorkelers + " + dv.value + " divers = " + total + "): choose both a snorkel and a dive vendor to check the combined headcount.", "mixed-none");
      else if (sr.vendorId !== dr.vendorId) add("info", "Mixed group: the snorkel vendor (" + sr.vendorName + ") and dive vendor (" + dr.vendorName + ") differ, so each is checked on its own and there is no combined limit.", "mixed-differ");
      else if (sCap == null || dCap == null) add("amber", "Mixed group (" + total + " people on one boat): combined headcount cannot be checked because " + (sCap == null ? "snorkel" : "dive") + " capacity is not on file for " + sr.vendorName + ".", "mixed-nocap");
      else { checked = true; const low = Math.min(sCap, dCap);
        if (total > low) add("amber", "Mixed group: " + sk.value + " snorkelers + " + dv.value + " divers = " + total + ", over the lower of the two capacities (" + low + "). The boat limit for a mixed trip may be lower than either figure. Check with " + sr.vendorName + ".", "mixed-over");
        else add("amber", "Mixed group: " + total + " people against the lower of the two capacities (" + low + "). Fits, but the boat limit for a mixed trip may be lower than either figure, so confirm with " + sr.vendorName + ".", "mixed-ok"); }
    }
    if (trips > 1 && out.some(x => x.kind !== "assumed" && x.kind !== "none")) add("amber", "This booking has " + trips + " boat trips. Capacity is per trip, and the booking does not say how the group is split, so the total headcount is compared. Confirm the split with the vendor.", "trips");
    return { items: out, hasAmber: out.some(x => x.level === "amber"), snorkelers, assumed, divers: dv.value, checked };
  }


  /* ---------- cost preview (staff only; customer-facing lines only, never cost or margin beyond Vendor Costs) ---------- */
  const maxOf = a => a.length ? Math.max.apply(null, a) : null;
  /* The highest linked value of each kind: Airtable's rollups take the highest, so the mirror does too. */
  function mirrorRates(idx, ids) {
    const rs = ids.map(i => idx.byId[i]).filter(r => r && r.value != null), sn = rs.filter(r => r.slot === "snorkel");
    const charter = sn.filter(r => r.model === "boat"), cr = charter.slice().sort((a, b) => b.value - a.value)[0];
    return { pp: maxOf(sn.filter(r => r.model === "pp").map(r => r.value)), charter: cr ? cr.value : null,
      gear: maxOf(rs.filter(r => r.slot === "gear" && r.k.snorkel).map(r => r.value)), cap: cr ? capacityOf(idx, cr.vendorId).snorkel : null };
  }
  /* i: the booking's pricing inputs (students, chaps, staff, trips, acts). Returns what the vendor cost and Total Package Price would be after the change.
     The "before" figures are Airtable's own stored values; the after figures are those plus the mirror's change, so anything the mirror does not model stays as Airtable has it. */
  function preview(b, idx, p, P, i) {
    const raw = b.raw, notes = [];
    if (!p.changedRates) return { available: false, reason: "No rate change." };
    if (!P || !P.isReady()) return { available: false, reason: "The Rates table constants are not loaded, so no price preview is possible. Airtable still recalculates the real price." };
    const model = txt(raw[F.pricingModel]);
    if (/Discovery|Legacy/.test(model)) return { available: false, reason: "The calculator does not model the " + model + " pricing model. Airtable recalculates the real price." };
    const s0 = P.snorkelVendor(i, mirrorRates(idx, p.links.before)), s1 = P.snorkelVendor(i, mirrorRates(idx, p.links.after));
    const other = p.changedSlots.filter(x => x !== "snorkel" && x !== "gear");
    if (other.length) notes.push("Changes to " + other.map(x => SLOT_LABEL[x].toLowerCase()).join(", ") + " are not priced in this preview. Airtable recalculates them.");
    if (p.changedSlots.includes("gear") && s1.model === "pp") notes.push("Per-person snorkel pricing does not add gear, so a gear change does not alter the preview.");
    const inc = s0.incomplete.concat(s1.incomplete);
    if (inc.length) return { available: false, reason: "Missing for the calculator: " + inc.join(", ") + ". No cost preview until it is on file.", notes };
    const stored = typeof raw[F.vendorAuto] === "number" ? raw[F.vendorAuto] : 0, total = typeof raw[F.total] === "number" ? raw[F.total] : null;
    const delta = Math.round((s1.cost - s0.cost) * 100) / 100, disc = +raw[F.discount] || 0, upl = typeof raw[F.upliftOverride] === "number" ? raw[F.upliftOverride] : (P.R.uplift || 0), factor = 1 + upl - disc;
    const manual = typeof raw[F.manualVendorEst] === "number" && raw[F.manualVendorEst] > 0;
    if (manual) notes.push("This booking uses the manual Estimated Vendor Cost, so a rate change does not change its total.");
    if (s0.model === "none" && s1.model === "none") notes.push("No snorkel rate is linked before or after, so the preview shows no change.");
    const vendorAfter = Math.round((stored + delta) * 100) / 100, totalAfter = total == null ? null : Math.round((total + (manual ? 0 : delta * factor)) * 100) / 100;
    return { available: true, before: s0, after: s1, delta, vendorBefore: stored, vendorAfter, totalBefore: total, totalAfter, factor, manual, notes, expectedTotal: totalAfter };
  }


  /* ---------- the guarded write ---------- */
  /* The only place this feature writes. Every gate must pass or it throws before anything is sent. Same gates as ReefEdits.commit, plus: only the
     three allowlisted fields, every required tick box, and the booking's links unchanged since the plan was made.
     Returns {saved, logOk, logError, log}. The change log is the shared ReefEdits.writeChangeLog (one Communications Log row). */
  async function commit(booking, p, o) {
    o = o || {}; const D = window.ReefData, M = window.ReefMode, E = window.ReefEdits;
    if (o.mode !== "live" || !M || !M.isLive()) throw new Error("Not in Live mode: nothing is saved from Sandbox.");
    if (o.confirmed !== true) throw new Error("The change was not confirmed.");
    if (String(o.reason || "").trim().length < E.MIN_REASON) throw new Error("A reason of at least " + E.MIN_REASON + " characters is required.");
    if (!p || !p.ok) throw new Error("Plan is not valid");
    if (!C.WRITES_ENABLED) throw new Error("Live editing is not switched on yet (writes are disabled in this build).");
    if (C.WRITES_TEST_RECORDS_ONLY && !String(booking.raw[F.name] || "").startsWith(C.TEST_PREFIX)) throw new Error("Only " + C.TEST_PREFIX + " test records may be saved live right now.");
    const caps = D.hasToken() ? D.capabilities() : null;
    if (!caps || caps.canWrite === false) throw new Error("Your token cannot write. Ask Martha for a write token.");
    const allowed = ALLOWLIST.map(k => F[k]);
    if (Object.keys(p.fields).some(k => !allowed.includes(k))) throw new Error("Internal error: field not on the vendor picker allowlist.");
    if ((p.acks || []).some(a => !(o.acks || []).includes(a.id))) throw new Error("Every tick box in the confirmation must be ticked.");
    const fresh = await D.getBooking(booking.id);
    if (!fresh || (fresh.fields[F.modified] || null) !== p.baseModified) throw new Error("Someone changed this booking since you opened it. Reload and re-apply.");
    if (p.changedRates) {
      const now = linked({ raw: fresh.fields }).slice().sort().join();
      if (now !== p.links.before.slice().sort().join()) throw new Error("The linked rates changed in Airtable since you opened this booking. Reload and re-apply.");
      if (!Array.isArray(p.fields[F.pricingRates]) || p.fields[F.pricingRates].some(id => typeof id !== "string" || !/^rec/.test(id))) throw new Error("Internal error: Pricing Rates must be a list of record IDs.");
    }
    await D._patch(C.T.bookings, booking.id, p.fields);   // the one write: the full Pricing Rates array and/or the two counts. If this throws nothing else runs.
    const user = o.user || caps.user, res = { saved: true, logOk: true, logError: null, log: E.buildLog(p, { reason: o.reason, user }) };
    try { await E.writeChangeLog(booking, p, { reason: o.reason, user }); } catch (e) { res.logOk = false; res.logError = e.message; }
    return res;
  }

  return { SLOTS, SLOT_LABEL, ALLOWLIST, index, classify, keyInfo, stemOf, hidden, pickPerStem, capacityOf, options, optionLabel, modelLabel, linked, current, matchOption, conflicts, neededSlots, initialChoice, plan, capacity, parseCount, mirrorRates, preview, commit };
})();
