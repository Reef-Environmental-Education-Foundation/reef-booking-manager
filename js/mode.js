/* SANDBOX / LIVE MODE. Small, DOM-free state machine so it can be tested on its own.
   - Every page load starts in Sandbox. The mode is never persisted (no browser storage of any kind).
   - Live needs REEF_CONFIG.WRITES_ENABLED and a token that can write. Without both the switch stays off with a plain reason.
   - Live returns to Sandbox by itself after LIVE_IDLE_MS with no activity, and when the token is cleared or stops working.
   Sandbox can never write: ReefData._patch/_create and ReefEdits.commit both refuse unless isLive(). */
window.ReefMode = (function () {
  const cbs = []; let live = false, ticker = null, lastTouch = 0, lastReason = "";
  const C = () => window.REEF_CONFIG;

  /* Can this session go Live at all? {ok, reason} */
  function availability() {
    if (!C().WRITES_ENABLED) return { ok: false, reason: "Live editing is not switched on yet" };
    const D = window.ReefData, caps = D && D.hasToken() ? D.capabilities() : null;
    if (!caps || caps.canWrite === false) return { ok: false, reason: "Your token cannot write. Ask Martha for a write token" };
    return { ok: true, reason: "" };
  }
  const remainingMs = () => live ? Math.max(0, C().LIVE_IDLE_MS - (Date.now() - lastTouch)) : null;
  const state = () => ({ mode: live ? "live" : "sandbox", reason: lastReason, remainingMs: remainingMs(), warn: live && remainingMs() <= C().LIVE_WARN_MS });
  const emit = () => { const s = state(); cbs.slice().forEach(cb => { try { cb(s); } catch (e) {} }); };

  function tick() {
    if (!live) return;
    if (!availability().ok) return toSandbox("Live editing stopped: the token was cleared or can no longer write.");
    if (remainingMs() <= 0) return toSandbox("Back in Sandbox: no activity for " + Math.round(C().LIVE_IDLE_MS / 60000) + " minutes.");
    if (remainingMs() <= C().LIVE_WARN_MS) emit();   // countdown only in the last stretch
  }
  function toSandbox(reason) {
    const was = live; live = false; lastReason = reason || "";
    if (ticker) { clearInterval(ticker); ticker = null; }
    if (was) emit();
  }
  /* Called after the user confirms the "Switch to Live?" dialog. Returns {ok, reason}. */
  function requestLive() {
    const a = availability(); if (!a.ok) return a;
    live = true; lastReason = ""; lastTouch = Date.now();
    if (ticker) clearInterval(ticker); ticker = setInterval(tick, 1000);
    emit(); return { ok: true, reason: "" };
  }
  /* Any click, key or input while Live resets the idle clock. */
  function touch() { if (live) lastTouch = Date.now(); }

  return {
    get: () => live ? "live" : "sandbox",
    isLive: () => live,
    availability, requestLive, toSandbox, touch, remainingMs, state, _tick: tick,
    onChange: cb => { cbs.push(cb); return () => { const i = cbs.indexOf(cb); if (i >= 0) cbs.splice(i, 1); }; }
  };
})();
