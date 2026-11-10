/* REEF Booking Program Manager: Pipeline screen (read-only).
   Shows where each current booking is in the sales process. Customer-facing figures only: it reads
   no cost, margin or other INTERNAL_KEYS field. Contains no booking data. */
(function () {
  const C = window.REEF_CONFIG;
  const COLS = [
    { id: 1, name: "Drafting", who: "REEF" },
    { id: 2, name: "Proposal sent", who: "School" },
    { id: 3, name: "Said yes", who: "REEF" },
    { id: 4, name: "Contract sent", who: "School" },
    { id: 5, name: "Signed", who: "Getting ready" }
  ];
  const lc = s => String(s == null ? "" : s).trim().toLowerCase();

  /* Which column a booking belongs in. Order matters: contract Sent first (unless Confirmed / In Progress), then Signed, then Status. */
  function stageOf(status, agreement) {
    const s = lc(status), a = lc(agreement), running = s === "confirmed" || s === "in progress";
    if (a === "sent" && !running) return 4;
    if (a === "signed" || running) return 5;
    if (s === "proposal sent") return 2;
    if (s === "verbal yes" || s === "contracted") return 3;
    return 1;   // Quoting, blank, or anything not recognised: nothing has been sent
  }

  /* Booking Name with the organization prefix (and the dash after it) removed. */
  function programOf(name, org) {
    let n = String(name || "").trim(); const o = String(org || "").trim();
    if (o && n.toLowerCase().startsWith(o.toLowerCase())) n = n.slice(o.length).replace(/^[\s\-–—:]+/, "");
    return n || String(name || "").trim();
  }

  const plural = (n, one, many) => n === 1 ? one : many;

  function headline(counts, active) {
    if (!active) return "There are no active bookings.";
    const p = counts[2], c = counts[4], s = counts[5], y = counts[3], d = counts[1];
    let t = "Of " + active + " active booking" + (active === 1 ? "" : "s") + ", " + p + " " + plural(p, "has a proposal", "have proposals") + " out waiting on the school, " +
      c + " " + plural(c, "has a contract", "have contracts") + " out waiting on a signature, and " + s + " " + plural(s, "is", "are") + " signed.";
    if (y) t += " " + y + " " + plural(y, "has", "have") + " said yes and still " + plural(y, "needs", "need") + " a contract sent.";
    t += " " + d + " " + plural(d, "is", "are") + " still " + plural(d, "a draft", "drafts") + " that nothing has been sent for.";
    return t;
  }

  /* Pure model: bookings in, columns / footer / flags out. x = { txt, daysTo, isDone, threshold, testPrefix }. */
  function model(bookings, x) {
    const F = C.F, cols = COLS.map(c => Object.assign({ cards: [], total: 0 }, c));
    let done = 0, tests = 0;
    const pref = x.testPrefix;
    bookings.forEach(b => {
      const name = b.g("name"), org = b.g("org");
      if (pref && (String(name || "").startsWith(pref) || String(org || "").startsWith(pref))) { tests++; return; }
      if (x.isDone(b)) { done++; return; }
      const st = x.txt(b.g("status")) || "", ag = x.txt(b.g("agreementStatus")) || "", stage = stageOf(st, ag);
      const dField = b.g("daysToArrival"), d = typeof dField === "number" ? dField : x.daysTo(b.g("arrival"));
      const resp = x.txt(b.g("response")) || "", replied = !!resp && lc(resp) !== "not yet responded";
      const reach = b.g("reach"), people = (b.g("students") || 0) + (b.g("chaps") || 0);
      const card = { id: b.id, stage, org: org || name || "", program: programOf(name, org), arrival: b.g("arrival"), days: d, people: typeof reach === "number" ? reach : people || null, total: b.g("total"), live: stage === 1 && !!b.g("approved"), options: 1, flags: [] };
      if (lc(st) === "proposal sent" && !b.g("proposalSent")) card.flags.push("Proposal Sent Date is blank");
      if (lc(st) === "proposal sent" && replied) card.flags.push("School replied: " + resp);
      if (stage === 2 && !replied && d != null && d <= x.threshold) card.flags.push(d >= 0 ? "Program is " + d + " day" + (d === 1 ? "" : "s") + " out with no reply recorded" : "Program date has passed with no reply recorded");
      if (stage === 5 && !x.txt(b.g("paymentStatus"))) card.flags.push("Deposit/Payment Status is blank");
      cols[stage - 1].cards.push(card);
    });
    const byDate = (a, b) => String(a.arrival || "9999").localeCompare(String(b.arrival || "9999"));
    cols.forEach(col => {
      col.cards.sort(byDate);
      const n = {}; col.cards.forEach(c => { const k = lc(c.org); n[k] = (n[k] || 0) + 1; });
      col.cards.forEach(c => { c.options = n[lc(c.org)]; col.total += typeof c.total === "number" ? c.total : 0; });
    });
    const counts = {}; cols.forEach(c => { counts[c.id] = c.cards.length; });
    const active = cols.reduce((t, c) => t + c.cards.length, 0);
    const flagged = [].concat(...cols.map(c => c.cards)).filter(c => c.flags.length).sort(byDate);
    return { cols, counts, active, done, tests, flagged, headline: headline(counts, active) };
  }

  function html(ctx) {
    const { esc, money, fmtD } = ctx, m = model(ctx.bookings, { txt: ctx.txt, daysTo: ctx.daysTo, isDone: ctx.isDone, threshold: C.PIPELINE_NO_REPLY_DAYS, testPrefix: C.TEST_PREFIX });
    const open = id => `REEF_UI.go('booking','${esc(id)}','overview')`;
    const dayTxt = d => d == null ? "no date" : d >= 0 ? d + " days out" : Math.abs(d) + " days ago";
    const card = c => `<div class="pcard" role="button" tabindex="0" data-bid="${esc(c.id)}" onclick="${open(c.id)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${open(c.id)}}">
      <div class="t">${esc(c.org)}</div><div class="m">${esc(c.program)}</div>
      ${c.options > 1 ? `<div class="m opt">one of ${c.options} options</div>` : ""}${c.live ? '<div><span class="chip c-chk">Proposal page live</span></div>' : ""}
      <div class="row"><span>${esc(fmtD(c.arrival))}</span><span class="m">${esc(dayTxt(c.days))}</span></div>
      <div class="row"><span class="m">${c.people == null ? "—" : esc(c.people) + " participants"}</span><b>${money(c.total)}</b></div></div>`;
    const col = c => `<section class="pcol" data-col="${c.id}"><header><div class="cn">${esc(c.name)}</div><div class="cm"><b class="count">${c.cards.length}</b> · <span class="val">${money(c.total)}</span></div><div class="who">${esc(c.who)}'s move</div></header>${c.cards.map(card).join("") || '<div class="note empty">None</div>'}</section>`;
    const need = m.flagged.map(c => `<div class="todo flagrow" data-bid="${esc(c.id)}"><div class="s s-open">!</div><div><a class="lnk" onclick="${open(c.id)}">${esc(c.org)}</a> <span class="small">${esc(c.program)} · ${esc(fmtD(c.arrival))}</span>${c.flags.map(f => `<div class="small">• ${esc(f)}</div>`).join("")}</div></div>`).join("");
    return `<h2>Pipeline</h2><p class="lead" id="pipeHead">${esc(m.headline)}</p>
      <div class="board">${m.cols.map(col).join("")}</div>
      <p class="note" id="pipeFoot">${m.done} completed or cancelled, ${m.tests} test record${m.tests === 1 ? "" : "s"}</p>
      <h3 class="mt">Needs a look</h3><div class="card" id="pipeNeed">${need || '<span class="note">Nothing flagged.</span>'}</div>`;
  }

  window.ReefPipeline = { model, html, stageOf, programOf, COLS };
})();
