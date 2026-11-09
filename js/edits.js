/* CONTROLLED EDITING. Plans, validates and explains a change (works in Sandbox and Live), and commits it (Live only).
   Controls: 1) whitelist of editable fields (config EDITABLE), never formulas; 2) per-field validation; 3) concurrency check
   (record unchanged since the user started editing); 4) approval-impact warnings from the live guardrail's watched-field list;
   5) a required reason and an explicit confirmation; 6) change log row in the Communications Log (writeChangeLog, one function so a
   dedicated table can replace it later); 7) master switches WRITES_ENABLED and WRITES_TEST_RECORDS_ONLY; 8) Live mode.
   plan() never writes. commit() throws unless every gate passes. */
window.ReefEdits = (function () {
  const C = window.REEF_CONFIG;
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const MIN_REASON = 10;
  const blank = v => v === null || v === undefined || v === "";
  const show = v => blank(v) ? "(blank)" : String(v);

  function validateField(key, raw, spec) {
    const v = typeof raw === "string" ? raw.trim() : raw;
    if (blank(v)) return spec.required ? { ok: false, err: "Required" } : { ok: true, value: null };
    if (spec.type === "int") {
      if (!/^-?\d+$/.test(String(v))) return { ok: false, err: "Whole number required" };
      const n = +v; if (n < spec.min || n > spec.max) return { ok: false, err: "Must be " + spec.min + " to " + spec.max };
      return { ok: true, value: n };
    }
    if (spec.type === "date") {
      if (!iso.test(v) || isNaN(Date.parse(v)) || new Date(v + "T00:00:00Z").toISOString().slice(0, 10) !== v) return { ok: false, err: "Use YYYY-MM-DD" };
      return { ok: true, value: v };
    }
    if (spec.type === "email") return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? { ok: true, value: v } : { ok: false, err: "Not a valid email" };
    return { ok: true, value: String(v) };
  }

  /* booking: model record from the app; changes: {key: newRawValue}; opts.baseModified: the Last Modified value the user started
     editing from (defaults to the booking's current one). Returns a plan; never writes. */
  function plan(booking, changes, opts) {
    opts = opts || {};
    const errors = {}, diff = [], fields = {}; let touchesWatched = false;
    for (const key of Object.keys(changes)) {
      const spec = C.EDITABLE[key];
      if (!spec) { errors[key] = "Field is not editable from this app (formula, link, price input or not on the safe list)"; continue; }
      const r = validateField(key, changes[key], spec);
      if (!r.ok) { errors[key] = r.err; continue; }
      const before = booking.raw[C.F[key]] === undefined ? null : booking.raw[C.F[key]];
      if (show(before) === show(r.value)) continue;
      diff.push({ key, label: spec.label, before, after: r.value, watched: !!spec.watched, customerFacing: !!spec.customerFacing, group: spec.group });
      fields[C.F[key]] = r.value; if (spec.watched) touchesWatched = true;
    }
    // cross-field rule: departure may not be before arrival
    const cur = key => (changes[key] !== undefined ? changes[key] : booking.raw[C.F[key]]);
    if (!errors.arrival && !errors.departure) {
      const a = cur("arrival"), d = cur("departure");
      if (a && d && Date.parse(d) < Date.parse(a)) errors.departure = "Departure is before arrival";
    }
    const has = k => diff.some(d => d.key === k);
    const approved = !!booking.raw[C.F.approved], propVer = booking.raw[C.F.propVer] || 0, acceptedVer = booking.raw[C.F.acceptedVer];
    const accepted = acceptedVer !== null && acceptedVer !== undefined;
    const unapproves = approved && touchesWatched;
    const headcountChanged = has("students") || has("chaps"), datesChanged = has("arrival") || has("departure"), customerFacingChanged = diff.some(d => d.customerFacing);
    const warnings = [];
    if (unapproves) warnings.push("This will un-approve the proposal, raise the Proposal Version from " + propVer + " to " + (propVer + 1) + ", and alert Martha in Slack. A school page that is already live stays up until it is republished. Re-approve before republishing.");
    if (accepted && touchesWatched) warnings.push("The school accepted v" + acceptedVer + ". Terms changed after acceptance should go through a Change Request.");
    if (datesChanged) warnings.push("Schedule blocks and vendor availability are NOT moved automatically. Check the Program tab afterwards.");
    if (customerFacingChanged) warnings.push("This text can appear on the school's pages after the next publish.");
    // the person must tick one box when the change un-approves or touches terms the school already accepted
    const ack = unapproves ? { needed: true, label: "I understand this un-approves the proposal" }
      : (accepted && touchesWatched ? { needed: true, label: "I understand the school already accepted v" + acceptedVer + " and these terms are changing" } : { needed: false, label: "" });
    const test = String(booking.raw[C.F.name] || "").startsWith(C.TEST_PREFIX);
    const writeBlockedBy = !C.WRITES_ENABLED ? "Live editing is not switched on yet" : (C.WRITES_TEST_RECORDS_ONLY && !test ? "Only " + C.TEST_PREFIX + " test records may be saved live right now" : null);
    return {
      ok: Object.keys(errors).length === 0 && diff.length > 0, errors, diff, fields, warnings, touchesWatched, approved, accepted, acceptedVer: accepted ? acceptedVer : null,
      headcountChanged, datesChanged, customerFacingChanged, ack, propVer, propVerKnown: booking.raw[C.F.propVer] != null, predicted: { approved: unapproves ? false : approved, propVer: unapproves ? propVer + 1 : propVer },
      isTestRecord: test, writeBlockedBy, baseModified: opts.baseModified !== undefined ? opts.baseModified : (booking.raw[C.F.modified] || null)
    };
  }

  /* Plain-text change log (shown on screen, copied if the write fails, and written to Airtable). */
  function buildLog(p, o) {
    o = o || {};
    const lines = p.diff.map(d => d.label + ": " + show(d.before) + " -> " + show(d.after));
    lines.push("", "Reason: " + String(o.reason || "").trim(), "Edited by: " + (o.user || "unknown") + " via Booking Manager v" + C.VERSION);
    if (p.propVerKnown) lines.push("Proposal Version: " + p.propVer + " before, " + (p.predicted.propVer === p.propVer ? "unchanged expected" : p.predicted.propVer + " expected after (approved booking, watched field)"));
    return { summary: "App edit: " + p.diff.map(d => d.label).join(", "), details: lines.join("\n") };
  }

  /* The ONLY place that records an edit. Communications Log, What = "Other" (an existing option; writes use typecast false, so a missing option would fail, and we never create options).
     "By" is a collaborator field and is NOT written; the editor's email goes in Details. */
  async function writeChangeLog(booking, p, o) {
    const X = window.ReefData.FX.comms, log = buildLog(p, o);
    await window.ReefData._create(C.T.comms, { [X.summary]: log.summary, [X.booking]: [booking.id], [X.details]: log.details, [X.what]: C.COMMS_WHAT });
    return log;
  }

  /* The real commit. Every gate must pass or it throws before anything is sent. Returns {saved, logOk, logError, log}. */
  async function commit(booking, p, o) {
    o = o || {}; const D = window.ReefData, M = window.ReefMode;
    if (o.mode !== "live" || !M || !M.isLive()) throw new Error("Not in Live mode: nothing is saved from Sandbox.");
    if (o.confirmed !== true) throw new Error("The change was not confirmed.");
    if (String(o.reason || "").trim().length < MIN_REASON) throw new Error("A reason of at least " + MIN_REASON + " characters is required.");
    if (!p || !p.ok) throw new Error("Plan is not valid");
    if (!C.WRITES_ENABLED) throw new Error("Live editing is not switched on yet (writes are disabled in this build).");
    if (C.WRITES_TEST_RECORDS_ONLY && !String(booking.raw[C.F.name] || "").startsWith(C.TEST_PREFIX)) throw new Error("Only " + C.TEST_PREFIX + " test records may be saved live right now.");
    const caps = D.hasToken() ? D.capabilities() : null;
    if (!caps || caps.canWrite === false) throw new Error("Your token cannot write. Ask Martha for a write token.");
    const fresh = await D.getBooking(booking.id);
    if (!fresh || (fresh.fields[C.F.modified] || null) !== p.baseModified) throw new Error("Someone changed this booking since you opened it. Reload and re-apply.");
    await D._patch(C.T.bookings, booking.id, p.fields);   // only the changed fields, one request. If this throws nothing else runs.
    const user = o.user || caps.user, res = { saved: true, logOk: true, logError: null, log: buildLog(p, { reason: o.reason, user }) };
    try { await writeChangeLog(booking, p, { reason: o.reason, user }); }
    catch (e) { res.logOk = false; res.logError = e.message; }   // never hide this: the UI shows it with a Copy button
    return res;
  }

  /* After a save, Airtable's formulas and the guardrail run asynchronously. Re-read ~1.5s later, then up to 2 more times 2s apart,
     stopping as soon as Airtable's total equals the calculator's expected total. */
  async function verifyAfterSave(o) {
    const sleep = o.sleep || (ms => new Promise(r => setTimeout(r, ms))), delays = o.delays || [1500, 2000, 2000];
    let rec = null, attempts = 0, total = null, match = false, readError = null;
    for (const d of delays) {
      await sleep(d); attempts++;
      try { rec = await o.read(); readError = null; if (o.onRead) o.onRead(rec); } catch (e) { readError = e.message; continue; }
      total = rec.fields[C.F.total]; total = typeof total === "number" ? total : null;
      match = o.expectedTotal != null && total != null && Math.abs(total - o.expectedTotal) < 0.005;
      if (match || o.expectedTotal == null) break;
    }
    const f = rec ? rec.fields : {}, observed = { approved: !!f[C.F.approved], propVer: f[C.F.propVer] === undefined ? null : f[C.F.propVer] };
    const pr = o.predicted || null;
    return { rec, attempts, readError, airtableTotal: total, expectedTotal: o.expectedTotal == null ? null : o.expectedTotal,
      diff: total != null && o.expectedTotal != null ? Math.round((total - o.expectedTotal) * 100) / 100 : null, match, observed, predicted: pr,
      predictedMatch: pr ? observed.approved === pr.approved && observed.propVer === pr.propVer : null };
  }

  return { plan, commit, validateField, buildLog, writeChangeLog, verifyAfterSave, MIN_REASON };
})();
