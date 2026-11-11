/* CONTRACT DRAFT (Zoho Sign). DOM-free so it can be tested on its own.
   Read side: state(booking) turns the booking's contract fields into what the panel shows and whether the button may be used.
   Action side: request() sets ONE checkbox ("Create Sign Draft (Rose)") to true. The Airtable automation
   "Contract Draft - Create on school approval, refresh until sent" does the rest (builds or rebuilds the UNSENT draft in Zoho Sign,
   writes Sign Draft Result and Sign Request ID, unticks the box, posts to #oxp-bookings). This app never talks to Zoho,
   never holds a Zoho token, never sends anything, and never writes any other field.
   Same gates as ReefEdits.commit: Live mode, explicit confirmation, WRITES_ENABLED, ZZZ-only switch, write-capable token. */
window.ReefContract = (function () {
  const C = window.REEF_CONFIG, F = C.F;
  const ACTION_FIELDS = ["signBox"];   // the whole write allowlist for this feature. Money, approval, Proposal Version and Contract Status are NOT here.
  const txt = v => v && typeof v === "object" && !Array.isArray(v) ? (v.name || "") : (v == null ? "" : String(v));

  /* The automation writes "YYYY-MM-DD HH:MM:SS UTC[ [manual]]: message". */
  function parseResult(s) {
    s = String(s || "");
    const m = s.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) UTC( \[manual\])?: ([\s\S]*)$/);
    return m ? { at: Date.parse(m[1].replace(" ", "T") + "Z"), manual: !!m[2], text: m[3] } : { at: null, manual: false, text: s };
  }
  function outcome(text) {
    if (!text) return "none";
    if (/UNSENT DRAFT ready/.test(text)) return "ok";
    if (/CHANGED AFTER SEND/.test(text)) return "locked";
    if (/^(Refreshed: )?DRY RUN/.test(text)) return "dry";
    if (/Nothing (created|changed)|script error/i.test(text)) return "blocked";
    return "info";
  }

  /* booking: {raw}. Never throws on missing fields. */
  function state(booking) {
    const raw = booking.raw || {}, name = String(raw[F.name] || "");
    const status = txt(raw[F.agreementStatus]) || "Not Sent", check = String(raw[F.contractCheck] || "").trim();
    const reqId = String(raw[F.signReqId] || "").trim(), box = !!raw[F.signBox];
    const res = parseResult(raw[F.signResult]);
    const locked = status === "Sent" || status === "Signed";
    let blockedBy = null;
    if (locked) blockedBy = "The contract is marked " + status + ". It cannot be created or rebuilt from here. If the booking changed after sending, Rose decides in Zoho Sign whether to recall and re-send.";
    else if (check !== "OK") blockedBy = "Contract Check says: " + (check || "not available") + ". Fix the booking in Airtable first.";
    else if (box) blockedBy = "A draft request is already running (the Create Sign Draft box is still ticked). Wait for the result.";
    const test = name.startsWith(C.TEST_PREFIX);
    const writeBlockedBy = !C.WRITES_ENABLED ? "Live editing is not switched on yet" : (C.WRITES_TEST_RECORDS_ONLY && !test ? "Only " + C.TEST_PREFIX + " test records may be used live right now" : null);
    return { status, locked, check, checkOk: check === "OK", reqId, hasDraft: !!reqId, box, result: res, resultRaw: String(raw[F.signResult] || ""), outcome: outcome(res.text),
      blockedBy, writeBlockedBy, isTestRecord: test, label: reqId ? "Refresh contract draft" : "Create contract draft" };
  }

  /* Every gate must pass or it throws before anything is sent. Returns {requested, prior, logOk, logError}. */
  async function request(booking, o) {
    o = o || {}; const D = window.ReefData, M = window.ReefMode;
    if (!M || !M.isLive()) throw new Error("Not in Live mode: nothing is saved from Sandbox.");
    if (o.confirmed !== true) throw new Error("The request was not confirmed.");
    if (!C.WRITES_ENABLED) throw new Error("Live editing is not switched on yet (writes are disabled in this build).");
    if (C.WRITES_TEST_RECORDS_ONLY && !String(booking.raw[F.name] || "").startsWith(C.TEST_PREFIX)) throw new Error("Only " + C.TEST_PREFIX + " test records may be used live right now.");
    const caps = D.hasToken() ? D.capabilities() : null;
    if (!caps || caps.canWrite === false) throw new Error("Your token cannot write. Ask Martha for a write token.");
    const fresh = await D.getBooking(booking.id);              // decide from Airtable's current values, not from what the page loaded
    if (!fresh) throw new Error("Could not re-read the booking.");
    const s = state({ raw: fresh.fields });
    if (s.blockedBy) throw new Error(s.blockedBy);
    const fields = { [F.signBox]: true };
    if (Object.keys(fields).some(k => !ACTION_FIELDS.some(a => F[a] === k))) throw new Error("Internal error: field not on the contract allowlist.");
    await D._patch(C.T.bookings, booking.id, fields);          // the one write. If this throws nothing else runs.
    const res = { requested: true, prior: { result: s.resultRaw, reqId: s.reqId }, logOk: true, logError: null, hadDraft: s.hasDraft };
    try {
      const X = D.FX.comms, user = o.user || caps.user;
      await D._create(C.T.comms, { [X.summary]: "App action: " + (s.hasDraft ? "refresh" : "create") + " contract draft", [X.booking]: [booking.id],
        [X.details]: "Ticked Create Sign Draft (Rose) from the Booking Manager.\nRequested by: " + user + " via Booking Manager v" + C.VERSION + "\nNothing is sent to the school; the draft stays unsent in Zoho Sign.", [X.what]: C.COMMS_WHAT });
    } catch (e) { res.logOk = false; res.logError = e.message; }
    return res;
  }

  /* The automation unticks the box and rewrites Sign Draft Result when it finishes. Poll until the box is off and the result text changed. */
  async function waitForResult(o) {
    const sleep = o.sleep || (ms => new Promise(r => setTimeout(r, ms))), every = o.everyMs || C.CONTRACT.POLL_MS, limit = o.timeoutMs || C.CONTRACT.POLL_TIMEOUT_MS;
    let waited = 0, attempts = 0, last = null, readError = null;
    while (waited <= limit) {
      await sleep(every); waited += every; attempts++;
      try { last = await o.read(); readError = null; if (o.onRead) o.onRead(last); } catch (e) { readError = e.message; continue; }
      const s = state({ raw: last.fields });
      if (!s.box && s.resultRaw && s.resultRaw !== o.prior.result) return { done: true, timedOut: false, attempts, readError: null, state: s };
    }
    return { done: false, timedOut: true, attempts, readError, state: last ? state({ raw: last.fields }) : null };
  }

  return { state, request, waitForResult, parseResult, outcome, ACTION_FIELDS };
})();
