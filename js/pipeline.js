/* REEF Booking Program Manager: Pipeline screen (read-only).
   One board that answers "where is every open booking in the sales process?": Drafting, Proposal sent, Said yes,
   Contract sent, Signed. Stages are derived from Airtable's Status and Agreement/Contract Status fields; nothing is
   stored or written. Shows customer-facing figures only (Total Package Price), never cost or margin.
   Hook: app.js calls ReefPipeline.html({...}) from the "pipeline" view. Contains no booking data. */
window.ReefPipeline = (function () {
  const STAGES = [
    { key: "draft",    label: "Drafting",      move: "REEF's move",   sub: "Quoting. Nothing sent to the school yet.",        tone: "" },
    { key: "proposal", label: "Proposal sent", move: "School's move", sub: "Waiting for the school to review.",               tone: "theirs" },
    { key: "yes",      label: "Said yes",      move: "REEF's move",   sub: "Agreed to move forward. Contract still to send.", tone: "" },
    { key: "contract", label: "Contract sent", move: "School's move", sub: "Waiting for a signature.",                        tone: "theirs" },
    { key: "signed",   label: "Signed",        move: "Getting ready", sub: "Contract signed. Pre-trip work and payments.",    tone: "done" }
  ];

  /* Which column a booking belongs in. Order matters: Confirmed / In Progress or a signed contract is always Signed;
     a contract marked Sent beats the proposal-stage statuses. */
  function stageOf(status, contract) {
    const st = String(status || "Quoting"), cs = String(contract || "");
    const signed = cs === "Signed" || st === "Confirmed" || st === "In Progress";
    if (signed) return "signed";
    if (cs === "Sent") return "contract";
    if (st === "Proposal Sent") return "proposal";
    if (st === "Verbal Yes" || st === "Contracted") return "yes";
    return "draft";
  }

  /* Plain-English flags for one open booking. `d` is days to arrival (or null). */
  function flagsOf(o, noReplyDays) {
    const f = [];
    const replied = o.response && o.response !== "Not Yet Responded";
    if (o.status === "Proposal Sent" && !o.proposalSent) f.push("Proposal Sent Date is blank");
    if (o.status === "Proposal Sent" && replied) f.push("School replied: " + o.response);
    if (o.stage === "proposal" && !replied && o.days != null && o.days >= 0 && o.days <= noReplyDays) f.push("Program is " + o.days + " days out with no reply recorded");
    if (o.stage === "signed" && !o.payment) f.push("Deposit/Payment Status is blank");
    return f;
  }

  /* Pure: turn app bookings into the board model. ctx supplies helpers so this stays testable. */
  function build(bookings, ctx) {
    const prefix = ctx.testPrefix || "ZZZ", days = ctx.noReplyDays || 45;
    const isTest = b => String(b.g("name") || "").startsWith(prefix) || String(b.g("org") || "").startsWith(prefix);
    const isPast = b => /complet|cancel|lost|declin/i.test(ctx.txt(b.g("status")) || "");
    const cols = {}; STAGES.forEach(s => cols[s.key] = []);
    let past = 0, test = 0;
    bookings.forEach(b => {
      if (isTest(b)) { test++; return; }
      if (isPast(b)) { past++; return; }
      const status = ctx.txt(b.g("status")) || "Quoting", contract = ctx.txt(b.g("agreementStatus")) || "";
      const stage = stageOf(status, contract);
      const d = ctx.daysTo(b.g("arrival"));
      const o = { b, id: b.id, stage, status, org: b.g("org") || b.g("name") || "", arrival: b.g("arrival"), days: d, people: b.g("reach") != null ? b.g("reach") : ((b.g("students") || 0) + (b.g("chaps") || 0)), value: b.g("total"), response: ctx.txt(b.g("response")) || "", proposalSent: b.g("proposalSent"), payment: ctx.txt(b.g("paymentStatus")) || "", live: !!b.g("approved") };
      const nm = String(b.g("name") || ""), org = String(b.g("org") || "");
      o.detail = org && nm.indexOf(org) === 0 ? nm.slice(org.length).replace(/^[\s\-–—]+/, "") : nm;
      o.flags = flagsOf(o, days);
      cols[stage].push(o);
    });
    Object.keys(cols).forEach(k => cols[k].sort((a, c) => String(a.arrival || "9999").localeCompare(String(c.arrival || "9999"))));
    STAGES.forEach(s => { const per = {}; cols[s.key].forEach(o => per[o.org] = (per[o.org] || 0) + 1); cols[s.key].forEach(o => o.options = per[o.org]); });
    const active = STAGES.reduce((t, s) => t + cols[s.key].length, 0);
    const sum = k => cols[k].reduce((t, o) => t + (+o.value || 0), 0);
    return { cols, active, past, test, sum };
  }

  const CSS = `
  .pl .pl-board{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;align-items:start;margin-bottom:14px}
  .pl .pl-col{background:#fff;border:1px solid var(--line);border-top:4px solid var(--line);border-radius:12px;padding:12px;min-width:0}
  .pl .pl-col.theirs{border-top-color:var(--amber)}.pl .pl-col.done{border-top-color:var(--green)}
  .pl .pl-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
  .pl .pl-top h3{margin:0}
  .pl .pl-n{font-size:28px;font-weight:700;color:var(--navy);font-variant-numeric:tabular-nums;line-height:1}
  .pl .pl-move{font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--mute);margin-top:2px}
  .pl .theirs .pl-move{color:var(--amber);font-weight:600}.pl .done .pl-move{color:var(--green);font-weight:600}
  .pl .pl-sub{font-size:12px;color:var(--mute);margin:4px 0 2px}
  .pl .pl-sum{font-size:12px;color:var(--mute);font-variant-numeric:tabular-nums;min-height:16px;margin-bottom:8px}
  .pl .pl-card{border:1px solid var(--line);border-radius:10px;padding:9px 10px;margin-bottom:8px;cursor:pointer;background:#fff}
  .pl .pl-card:hover{box-shadow:0 2px 10px rgba(11,60,93,.12)}
  .pl .pl-card .t{font-weight:700;color:var(--navy);overflow-wrap:anywhere}
  .pl .pl-card .m{font-size:12px;color:var(--mute);overflow-wrap:anywhere}
  .pl .pl-card .r{display:flex;flex-wrap:wrap;gap:2px 10px;font-size:12px;margin-top:4px;font-variant-numeric:tabular-nums}
  .pl .pl-card .fl{font-size:12px;color:var(--amber);margin-top:4px}
  .pl .pl-empty{font-size:12px;color:var(--mute)}
  .pl ul.pl-attn{list-style:none;margin:0;padding:0}
  .pl ul.pl-attn li{padding:6px 0;border-bottom:1px dashed var(--line);display:flex;flex-wrap:wrap;gap:2px 12px}
  .pl ul.pl-attn li:last-child{border-bottom:0}
  .pl .pl-foot{font-size:12px;color:var(--mute)}`;
  function ensureCss() { if (document.getElementById("plCss")) return; const s = document.createElement("style"); s.id = "plCss"; s.textContent = CSS; document.head.appendChild(s); }

  function html(ctx) {
    ensureCss();
    const { esc, money, fmtD } = ctx, m = build(ctx.bookings, ctx), c = m.cols, n = k => c[k].length;
    const head = `Of <b>${m.active}</b> active booking${m.active === 1 ? "" : "s"}, <b>${n("proposal")}</b> ${n("proposal") === 1 ? "has" : "have"} a proposal out waiting on the school, <b>${n("contract")}</b> ${n("contract") === 1 ? "has" : "have"} a contract out waiting on a signature, and <b>${n("signed")}</b> ${n("signed") === 1 ? "is" : "are"} signed. <b>${n("draft")}</b> ${n("draft") === 1 ? "is" : "are"} still ${n("draft") === 1 ? "a draft" : "drafts"} that nothing has been sent for.`;
    const card = o => `<div class="pl-card" role="button" tabindex="0" data-id="${esc(o.id)}" onclick="REEF_UI.go('booking','${esc(o.id)}','overview')" onkeydown="if(event.key==='Enter')REEF_UI.go('booking','${esc(o.id)}','overview')">
      <div class="t">${esc(o.org)}</div>
      <div class="m">${esc(o.detail)}${o.options > 1 ? ` (one of ${o.options} options)` : ""}</div>
      <div class="r"><span>${esc(fmtD(o.arrival))}</span>${o.days != null ? `<span>${o.days >= 0 ? o.days + " days out" : Math.abs(o.days) + " days ago"}</span>` : ""}${o.people ? `<span>${esc(o.people)} people</span>` : ""}${o.value ? `<span>${money(o.value)}</span>` : ""}</div>
      ${o.stage === "draft" && o.live ? `<div class="m mt">${ctx.chip("notb", "Proposal page live")}</div>` : ""}
      ${o.flags.map(f => `<div class="fl">${esc(f)}</div>`).join("")}</div>`;
    const col = s => `<section class="pl-col ${s.tone}" id="stage-${s.key}" aria-label="${esc(s.label)}"><div class="pl-top"><h3>${esc(s.label)}</h3><span class="pl-n" data-count="${s.key}">${n(s.key)}</span></div>
      <div class="pl-move">${esc(s.move)}</div><p class="pl-sub">${esc(s.sub)}</p><div class="pl-sum">${n(s.key) ? money(m.sum(s.key)) + " total" : ""}</div>
      ${n(s.key) ? c[s.key].map(card).join("") : '<div class="pl-empty">None right now</div>'}</section>`;
    const flagged = [].concat(...STAGES.map(s => c[s.key])).filter(o => o.flags.length).sort((a, b) => (a.days == null ? 1e9 : a.days) - (b.days == null ? 1e9 : b.days));
    return `<div class="pl"><h2>Pipeline</h2><p class="lead" id="plHead">${head}</p>
      <div class="pl-board" id="plBoard">${STAGES.map(col).join("")}</div>
      <div class="card" id="plAttn"><h3>Needs a look</h3>${flagged.length ? `<ul class="pl-attn">${flagged.map(o => `<li><b>${esc(o.org)}</b><span>${esc(o.flags.join("; "))}</span></li>`).join("")}</ul>` : '<div class="note">Nothing flagged right now.</div>'}</div>
      <p class="pl-foot" id="plFoot">Not shown: <b data-count="past">${m.past}</b> completed or cancelled bookings and <b data-count="test">${m.test}</b> test records.</p>
      <details class="note"><summary>How the stages are decided</summary><p>Each booking is placed from its Status and its Agreement/Contract Status in Airtable. Quoting is Drafting. Proposal Sent is Proposal sent. Verbal Yes, or Contracted without a signature recorded, is Said yes. An Agreement/Contract Status of Sent puts a booking in Contract sent. A signed contract, or a Status of Confirmed or In Progress, is Signed. Dollar figures are the Total Package Price the school sees. A proposal with no reply recorded is flagged when the program is within ${ctx.noReplyDays || 45} days.</p></details></div>`;
  }
  return { STAGES, stageOf, flagsOf, build, html };
})();
