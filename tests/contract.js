/* Contract draft panel test. SYNTHETIC data only, no network, no token. Run: node tests/contract.js */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + m); };

function harness(cfgOver, serverRec) {
  const calls = []; let rec = serverRec;
  const R = (b, s) => ({ ok: !s || s < 300, status: s || 200, json: async () => b, text: async () => JSON.stringify(b) });
  const ctx = { console, Date, setTimeout, clearTimeout, window: {}, setInterval: () => 1, clearInterval() {},
    fetch: async (url, init) => { init = init || {}; const body = init.body ? JSON.parse(init.body) : null, method = init.method || "GET"; calls.push({ method, url, body });
      if (/meta\/whoami/.test(url)) return R({ id: "usrX", email: "rose@example.test", scopes: h.scopes });
      if (/listRecords/.test(url)) return R({ records: rec ? [rec] : [] });
      if (method === "PATCH") { Object.assign(rec.fields, body.fields); return R({ id: rec.id, fields: body.fields }); }
      if (method === "POST") return R({ records: [{ id: "recLOG" }] });
      return R({}, 404); } };
  vm.createContext(ctx);
  for (const fl of ["config", "mode", "adapter-airtable", "edits", "contract"]) vm.runInContext(fs.readFileSync(path.join(root, "js", fl + ".js"), "utf8"), ctx);
  const w = ctx.window; Object.assign(w.REEF_CONFIG, cfgOver || {});
  const h = { w, calls, scopes: ["data.records:read", "data.records:write"], set rec(r) { rec = r; }, get rec() { return rec },
    writes: () => calls.filter(c => c.method === "PATCH"), logs: () => calls.filter(c => c.method === "POST" && !/listRecords/.test(c.url)) };
  return h;
}
const mkRec = (F, name, extra) => ({ id: "recZZZ0000000001", fields: Object.assign({ [F.name]: name, [F.contractCheck]: "OK", [F.agreementStatus]: "Not Sent" }, extra || {}) });
const goLive = async h => { h.w.ReefData.setToken("pat_TEST"); await h.w.ReefData.verify(); return h.w.ReefMode.requestLive(); };
const throwsMsg = async (fn, re) => { try { await fn(); return false; } catch (e) { return re.test(e.message); } };

(async () => {
  let h = harness({ WRITES_ENABLED: true }); const F = h.w.REEF_CONFIG.F, K = h.w.ReefContract;
  const b = (extra, name) => ({ id: "recZZZ0000000001", raw: mkRec(F, name || "ZZZ Contract Test", extra).fields });

  // ---- read side ----
  let s = K.state(b());
  ok(s.checkOk && !s.locked && !s.hasDraft && !s.blockedBy && s.label === "Create contract draft", "state: OK check, not sent, no draft -> button allowed, label Create");
  s = K.state(b({ [F.signReqId]: "123456" })); ok(s.hasDraft && s.label === "Refresh contract draft" && !s.blockedBy, "state: a Sign Request ID makes it Refresh");
  ok(K.state(b({ [F.agreementStatus]: "Sent" })).blockedBy && K.state(b({ [F.agreementStatus]: "Signed" })).locked, "state: Sent and Signed are locked");
  ok(/STOP: no price/.test(K.state(b({ [F.contractCheck]: "STOP: no price" })).blockedBy), "state: Contract Check STOP blocks and shows the reason");
  ok(/already running/.test(K.state(b({ [F.signBox]: true })).blockedBy), "state: box already ticked blocks (request in progress)");
  ok(K.state({ raw: {} }).blockedBy && K.state({ raw: {} }).status === "Not Sent", "state: empty record does not throw");
  const pr = K.parseResult("2026-11-11 20:00:05 UTC [manual]: UNSENT DRAFT ready for X (request 99).");
  ok(pr.manual && pr.at === Date.parse("2026-11-11T20:00:05Z") && K.outcome(pr.text) === "ok", "parseResult: timestamp, [manual] flag, ok outcome");
  ok(K.outcome("CHANGED AFTER SEND for X") === "locked" && K.outcome("Nothing created for X: Contract Check is not OK") === "blocked" && K.outcome("") === "none", "outcome: locked / blocked / none");

  // ---- gates ----
  const bk = b();
  h.rec = mkRec(F, "ZZZ Contract Test");
  ok(await throwsMsg(() => K.request(bk, { confirmed: true }), /Not in Live mode/), "request: refused in Sandbox");
  await goLive(h);
  ok(await throwsMsg(() => K.request(bk, {}), /not confirmed/), "request: refused without confirmation");
  ok(h.writes().length === 0, "no write left the page before every gate passed");
  let hOff = harness({ WRITES_ENABLED: false }); hOff.rec = mkRec(F, "ZZZ X"); hOff.w.ReefData.setToken("t"); await hOff.w.ReefData.verify();
  ok(!hOff.w.ReefMode.requestLive().ok, "Live cannot start while WRITES_ENABLED is false");
  let hReal = harness({ WRITES_ENABLED: true }); hReal.rec = mkRec(hReal.w.REEF_CONFIG.F, "Real School - 2027"); await goLive(hReal);
  ok(await throwsMsg(() => hReal.w.ReefContract.request({ id: hReal.rec.id, raw: hReal.rec.fields }, { confirmed: true }), /Only ZZZ test records/) && hReal.writes().length === 0, "request: real (non-ZZZ) record refused while WRITES_TEST_RECORDS_ONLY is true");
  let hRo = harness({ WRITES_ENABLED: true }); hRo.scopes = ["data.records:read"]; hRo.rec = mkRec(F, "ZZZ X"); hRo.w.ReefData.setToken("t"); await hRo.w.ReefData.verify();
  ok(!hRo.w.ReefMode.requestLive().ok, "read-only token cannot go Live, so cannot request");

  // ---- guard rails use Airtable's CURRENT values, not the page's stale copy ----
  h.rec = mkRec(F, "ZZZ Contract Test", { [F.agreementStatus]: "Signed" });
  ok(await throwsMsg(() => K.request(bk, { confirmed: true }), /marked Signed/) && h.writes().length === 0, "request: page looked Not Sent but Airtable says Signed -> refused, nothing written");
  h.rec = mkRec(F, "ZZZ Contract Test", { [F.contractCheck]: "STOP: program is less than 14 days away" });
  ok(await throwsMsg(() => K.request(bk, { confirmed: true }), /Contract Check says: STOP/) && h.writes().length === 0, "request: Contract Check STOP in Airtable -> refused, nothing written");
  h.rec = mkRec(F, "ZZZ Contract Test", { [F.signBox]: true });
  ok(await throwsMsg(() => K.request(bk, { confirmed: true }), /already running/) && h.writes().length === 0, "request: box already ticked -> refused (no double click)");

  // ---- the happy path writes exactly one field ----
  h.rec = mkRec(F, "ZZZ Contract Test", { [F.signReqId]: "111", [F.signResult]: "2026-11-11 19:00:00 UTC [manual]: UNSENT DRAFT ready (request 111)." });
  const r = await K.request(bk, { confirmed: true });
  const w1 = h.writes();
  ok(r.requested && w1.length === 1 && Object.keys(w1[0].body.fields).length === 1 && w1[0].body.fields[F.signBox] === true && w1[0].body.typecast === false, "request: exactly one PATCH, only the Create Sign Draft box = true, typecast false");
  ok(K.ACTION_FIELDS.length === 1 && K.ACTION_FIELDS[0] === "signBox", "allowlist is that one field only");
  ok(h.logs().length === 1 && /App action: refresh contract draft/.test(h.logs()[0].body.records[0].fields[h.w.ReefData.FX.comms.summary]), "request: one Communications Log row, says refresh");
  ok(!JSON.stringify(h.calls).includes("zoho") && !JSON.stringify(h.calls).includes("sign.zoho"), "no call to Zoho from the page");

  // ---- waiting for the result ----
  let n = 0; const fields = () => h.rec.fields;
  const read = async () => { n++; if (n === 2) { Object.assign(h.rec.fields, { [F.signBox]: false, [F.signResult]: "2026-11-11 20:00:09 UTC [manual]: UNSENT DRAFT ready for ZZZ (request 222).", [F.signReqId]: "222" }); } return { id: h.rec.id, fields: h.rec.fields }; };
  const wr = await K.waitForResult({ read, prior: r.prior, sleep: async () => {}, everyMs: 3000, timeoutMs: 90000 });
  ok(wr.done && !wr.timedOut && wr.attempts === 2 && wr.state.outcome === "ok" && wr.state.reqId === "222", "waitForResult: stops when the box is unticked and the result text changed");
  h.rec.fields[F.signBox] = true; const wt = await K.waitForResult({ read: async () => ({ id: h.rec.id, fields: h.rec.fields }), prior: { result: "x" }, sleep: async () => {}, everyMs: 30000, timeoutMs: 90000 });
  ok(wt.timedOut && !wt.done, "waitForResult: times out cleanly if the automation never answers");
  h.rec.fields[F.signBox] = false; const wblock = await K.waitForResult({ read: async () => ({ id: h.rec.id, fields: Object.assign({}, h.rec.fields, { [F.signResult]: "2026-11-11 20:05:00 UTC [manual]: Nothing created for ZZZ: Zoho sign-in failed (invalid_client)." }) }), prior: { result: "old" }, sleep: async () => {}, everyMs: 3000 });
  ok(wblock.done && wblock.state.outcome === "blocked", "waitForResult: reports an automation failure as blocked, not success");

  // ---- static checks ----
  const cfg = fs.readFileSync(path.join(root, "js/config.js"), "utf8"), src = fs.readFileSync(path.join(root, "js/contract.js"), "utf8"), app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  ok(!/Zoho-oauthtoken|refresh_token|client_secret|ZOHO_REFRESH/i.test(src + app + cfg), "no Zoho token or secret anywhere in the repo files");
  ok(!/signBox/.test(cfg.slice(cfg.indexOf("EDITABLE:"))), "the box is not in the Edit tab's EDITABLE list");
  ok(/js\/contract\.js/.test(fs.readFileSync(path.join(root, "index.html"), "utf8")), "index.html loads contract.js");
  console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
})();
