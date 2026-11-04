/* CONTROLLED EDITING (dry-run). Plans, validates and explains a change. Cannot write: the write path is blocked
   by REEF_CONFIG.WRITES_ENABLED=false and, even if enabled, by the ZZZ-only rule. Controls:
   1) whitelist of editable fields, never formulas; 2) per-field validation; 3) concurrency check (record unchanged since loaded);
   4) approval-impact warning from the live guardrail's watched-field list; 5) change log entry prepared for the Communications Log. */
window.ReefEdits = (function () {
  const C = window.REEF_CONFIG;
  const iso = /^\d{4}-\d{2}-\d{2}$/;

  function validateField(key, raw, spec, ctx) {
    const v = typeof raw === "string" ? raw.trim() : raw;
    if (v === "" || v === null || v === undefined) return { ok: true, value: null };
    if (spec.type === "int") {
      if (!/^-?\d+$/.test(String(v))) return { ok: false, err: "Whole number required" };
      const n = +v; if (n < spec.min || n > spec.max) return { ok: false, err: "Must be " + spec.min + " to " + spec.max };
      return { ok: true, value: n };
    }
    if (spec.type === "date") {
      if (!iso.test(v) || isNaN(Date.parse(v))) return { ok: false, err: "Use YYYY-MM-DD" };
      return { ok: true, value: v };
    }
    if (spec.type === "email") return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? { ok: true, value: v } : { ok: false, err: "Not a valid email" };
    return { ok: true, value: String(v) };
  }

  /* booking: model record from the app; changes: {key: newRawValue}. Returns a plan; never writes. */
  function plan(booking, changes) {
    const errors = {}, diff = [], fields = {}; let touchesWatched = false;
    for (const key of Object.keys(changes)) {
      const spec = C.EDITABLE[key];
      if (!spec) { errors[key] = "Field is not editable from this app (formula, link or not on the safe list)"; continue; }
      const r = validateField(key, changes[key], spec);
      if (!r.ok) { errors[key] = r.err; continue; }
      const before = booking.raw[C.F[key]] === undefined ? null : booking.raw[C.F[key]];
      if (String(before) === String(r.value)) continue;
      diff.push({ key, label: spec.label, before, after: r.value, watched: spec.watched });
      fields[C.F[key]] = r.value; if (spec.watched) touchesWatched = true;
    }
    // cross-field rules
    const arr = key => (changes[key] !== undefined ? changes[key] : booking.raw[C.F[key]]);
    if (!errors.arrival && !errors.departure) {
      const a = arr("arrival"), d = arr("departure");
      if (a && d && Date.parse(d) < Date.parse(a)) errors.departure = "Departure is before arrival";
    }
    const approved = !!booking.raw[C.F.approved];
    const warnings = [];
    if (approved && touchesWatched) warnings.push("This booking is Approved to Share. Saving a price- or schedule-affecting field will un-approve it, bump the Proposal Version to " + ((booking.raw[C.F.propVer] || 0) + 1) + " and post a Slack alert. A live school page stays up until you republish. Prefer: start a new draft first, edit freely, then approve once.");
    if (booking.raw[C.F.acceptedVer] != null && touchesWatched) warnings.push("The school has an accepted proposal (v" + booking.raw[C.F.acceptedVer] + "). Terms changed after acceptance should go through a Change Request.");
    const test = String(booking.raw[C.F.name] || "").startsWith(C.TEST_PREFIX);
    const writeBlockedBy = !C.WRITES_ENABLED ? "Writes are switched off in this build" : (C.WRITES_TEST_RECORDS_ONLY && !test ? "Only " + C.TEST_PREFIX + " test records may be written" : null);
    const logEntry = {
      summary: "App edit: " + diff.map(d => d.label).join(", "),
      details: diff.map(d => d.label + ": " + (d.before === null ? "(blank)" : d.before) + " -> " + (d.after === null ? "(blank)" : d.after)).join("\n"),
      version: booking.raw[C.F.propVer] || null
    };
    return { ok: Object.keys(errors).length === 0 && diff.length > 0, errors, diff, fields, warnings, touchesWatched, approved, isTestRecord: test, writeBlockedBy, logEntry, baseModified: booking.raw[C.F.modified] || null };
  }

  /* The real commit. Re-checks every control. Throws unless all pass. Not reachable from the UI in this build. */
  async function commit(booking, p) {
    if (!p.ok) throw new Error("Plan is not valid");
    if (p.writeBlockedBy) throw new Error(p.writeBlockedBy);
    const fresh = await window.ReefData.getBooking(booking.id);
    if ((fresh.fields[C.F.modified] || null) !== p.baseModified) throw new Error("Someone changed this booking since you opened it. Reload and re-apply.");
    await window.ReefData._patch(C.T.bookings, booking.id, p.fields);
    await window.ReefData._create(C.T.comms, { [window.ReefData.FX.comms.summary]: p.logEntry.summary, [window.ReefData.FX.comms.booking]: [booking.id], [window.ReefData.FX.comms.details]: p.logEntry.details, [window.ReefData.FX.comms.what]: "Internal note" });
    return true;
  }
  return { plan, commit, validateField };
})();
