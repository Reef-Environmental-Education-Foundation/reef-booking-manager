/* REEF Booking Program Manager: UI. Reads through ReefData only. Contains no booking data. */
(function () {
  const C = window.REEF_CONFIG, F = C.F, D = window.ReefData, P = window.ReefPricing, E = window.ReefEdits;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => n == null || n === "" || isNaN(n) ? "—" : "$" + Math.round(+n).toLocaleString("en-US");
  const money2 = n => n == null || isNaN(n) ? "—" : "$" + (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtD = d => d ? new Date(String(d).slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—";
  const today = () => new Date().toISOString().slice(0, 10);
  const daysTo = d => d ? Math.round((Date.parse(String(d).slice(0, 10)) - Date.parse(today())) / 864e5) : null;
  const txt = v => v && typeof v === "object" && !Array.isArray(v) ? (v.name || v.state || "") : (Array.isArray(v) ? v.map(txt).join(", ") : v);
  const fmt12 = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || "")); if (!m) return String(t || ""); const h = +m[1]; return ((h % 12) || 12) + ":" + m[2] + " " + (h < 12 ? "AM" : "PM"); };
  const mins = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || "")); return m ? +m[1] * 60 + +m[2] : 9999; };
  const chip = (k, t) => `<span class="chip c-${k}">${esc(t)}</span>`;
  const atUrl = (tbl, rec) => `https://airtable.com/${C.BASE_ID}/${tbl}/${rec}`;

  const S = { auto: true, loadedAt: null, loadErr: null, data: null, bookings: [], view: "home", bid: null, tab: "overview", role: "staff", filter: "active", q: "", wi: null, edit: {}, plan: null, caps: null };

  /* ---------- model ---------- */
  function build(data) {
    const by = (rows, linkId) => { const m = {}; rows.forEach(r => (r.fields[linkId] || []).forEach(b => (m[b] = m[b] || []).push(r))); return m; };
    const X = D.FX, sch = by(data.schedule, X.schedule.booking), com = by(data.comms, X.comms.booking), chk = by(data.checklist, X.checklist.booking),
      chg = by(data.changes, X.changes.booking), itn = by(data.itin, X.itin.booking), ver = by(data.versions || [], X.versions.booking), vl = by(data.vlines || [], X.vlines.booking);
    S.bookings = data.bookings.map(r => {
      const raw = r.fields;
      return { id: r.id, raw, g: k => raw[F[k]], schedule: sch[r.id] || [], comms: com[r.id] || [], checklist: chk[r.id] || [], changes: chg[r.id] || [], itin: itn[r.id] || [], versions: ver[r.id] || [], vlines: vl[r.id] || [] };
    });
    S.bookings.sort((a, b) => String(a.g("arrival") || "9999").localeCompare(String(b.g("arrival") || "9999")));
  }
  const cur = () => S.bookings.find(b => b.id === S.bid);
  const isDone = b => /complet|cancel|lost|declin/i.test(txt(b.g("status")) || "");
  const isTest = b => String(b.g("name") || "").startsWith(C.TEST_PREFIX);
  const internal = html => S.role === "rose" ? html : "";

  function flags(b) {
    const f = [];
    const check = b.g("check"); if (check) String(check).split("\n").map(s => s.replace(/^•\s*/, "").trim()).filter(Boolean).forEach(x => f.push(["y", x, "Airtable 'Check' formula field on the booking"]));
    if (b.g("schedChanged") && String(txt(b.g("schedChanged"))).trim()) f.push(["r", String(txt(b.g("schedChanged"))).replace(/^WARNING:\s*/i, "Schedule: "), "Airtable 'Schedule changed after approval' field"]);
    if (b.g("approved") && b.g("publishedVer") != null && b.g("approvedVer") != null && b.g("publishedVer") < b.g("approvedVer")) f.push(["y", "Approved v" + b.g("approvedVer") + " is not published yet (live page shows v" + b.g("publishedVer") + ")", "Approved Version compared with Published Version (Airtable fields)"]);
    const fu = b.g("followUp"); if (fu && daysTo(fu) < 0 && !isDone(b)) f.push(["r", "Follow-up overdue since " + fmtD(fu), "Follow-up Date is in the past and the booking is still open"]);
    return f;
  }

  /* ---------- shell ---------- */
  const TABS = [["overview", "Overview", "📋"], ["budget", "Budget & Pricing", "💲"], ["vendors", "Vendor Options", "⚓"], ["program", "Program & Itinerary", "🗓"], ["comms", "Communications", "✉"], ["ready", "Get Ready", "✔"], ["contract", "Contracts & Payments", "📝"], ["edit", "Edit (preview)", "✎"]];
  function go(view, bid, tab) { S.view = view; if (bid) { if (S.bid !== bid) { S.wi = null; S.edit = {}; S.plan = null; } S.bid = bid; } if (tab) S.tab = tab; render(); window.scrollTo(0, 0); }
  window.REEF_UI = { go, setQ: v => { S.q = v; render(true); }, setFilter: v => { S.filter = v; render(); }, refresh: () => load(true), setAuto: v => { S.auto = !!v; schedule(); } };

  function statusbar() {
    const c = S.caps || {};
    $("statusbar").innerHTML = `<span>${chip("live", "LIVE DATA")} <span id="loadedAt">Last loaded at ${esc(new Date(S.data.loadedAt).toLocaleTimeString())}</span>${S.loadErr ? " <b>(refresh failed: " + esc(S.loadErr) + ")</b>" : ""}</span>
      <span><button class="btn alt" id="sbRefresh" onclick="REEF_UI.refresh()">Refresh from Airtable</button> <label><input type="checkbox" id="autoRef" ${S.auto ? "checked" : ""} onchange="REEF_UI.setAuto(this.checked)"> Auto-refresh every 5 min</label></span>
      <span>Token: ${c.canRead === false ? "<b>cannot read</b>" : "read ok"}, ${c.canWrite ? "<b>has write scope (the app still will not write)</b>" : "read-only"}</span>
      <span>Editing: <b>OFF</b> (dry-run preview only)</span>
      <span>Cost/margin hiding is a display setting, not security: a token can read everything in the base.</span>`;
    $("who").textContent = c.user ? "Signed in with " + c.user : "";
  }
  function nav() {
    const b = cur();
    let h = `<h4>Workspace</h4>
      <button class="${S.view === "home" ? "on" : ""}" onclick="REEF_UI.go('home')">🏠 Today</button>
      <button class="${S.view === "list" ? "on" : ""}" onclick="REEF_UI.go('list')">📚 All bookings</button>
      <button class="${S.view === "new" ? "on" : ""}" onclick="REEF_UI.go('new')">➕ New booking / EPO inquiry</button>`;
    if (b) {
      h += `<h4>Open booking</h4><div class="bk"><b>${esc(b.g("org") || b.g("name"))}</b>${esc(fmtD(b.g("arrival")))}</div>`;
      h += TABS.map(t => `<button class="${S.view === "booking" && S.tab === t[0] ? "on" : ""}" onclick="REEF_UI.go('booking',null,'${t[0]}')">${t[2]} ${t[1]}</button>`).join("");
    }
    $("nav").innerHTML = h;
  }
  function render(keepFocus) {
    if (!S.data) return; statusbar(); nav();
    const m = $("main");
    const fn = { home, list, new: newBooking, booking }[S.view] || home;
    m.innerHTML = fn();
    if (keepFocus) { const q = $("q"); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
    if (S.view === "booking" && S.tab === "budget") wireBudget();
    if (S.view === "booking" && S.tab === "vendors") wireVendors();
    if (S.view === "booking" && S.tab === "edit") wireEdit();
  }

  /* ---------- Today ---------- */
  function card(b) {
    const fl = flags(b), d = daysTo(b.g("arrival"));
    const cls = fl.some(x => x[0] === "r") ? "urg" : fl.length ? "att" : isDone(b) ? "done" : "";
    return `<div class="bcard ${cls}" onclick="REEF_UI.go('booking','${b.id}','overview')">
      <div><div class="t">${esc(b.g("org") || b.g("name"))}${isTest(b) ? " " + chip("notb", "TEST") : ""}</div><div class="m">${esc(txt(b.g("type")) || "")} · ${esc(txt(b.g("location")) || "")}</div></div>
      <div><div>${esc(fmtD(b.g("arrival")))}</div><div class="m">${d == null ? "no date" : d >= 0 ? d + " days out" : Math.abs(d) + " days ago"}</div></div>
      <div><div>${esc(b.g("students") || 0)} students + ${esc(b.g("chaps") || 0)} chaps</div><div class="m">${money(b.g("total"))}</div></div>
      <div><div>${chip("plan", txt(b.g("status")) || "—")}</div><div class="m">${fl.length ? `<details class="why" onclick="event.stopPropagation()"><summary>${fl.length} item${fl.length > 1 ? "s" : ""} to check</summary>${fl.map(x => `<div class="small">• ${esc(x[1])}<br><i>Source: ${esc(x[2])}</i></div>`).join("")}</details>` : "Nothing flagged"}</div></div>
      <div>›</div></div>`;
  }
  function home() {
    const act = S.bookings.filter(b => !isDone(b) && !isTest(b));
    const need = act.filter(b => flags(b).length);
    const soon = act.filter(b => { const d = daysTo(b.g("arrival")); return d != null && d >= 0 && d <= 60; });
    const awaiting = act.filter(b => /sent|await|quot/i.test(txt(b.g("status")) || "") && !b.g("acceptedVer"));
    const next = act.filter(b => b.g("nextAction")).slice(0, 8);
    return `<h2>Today</h2><p class="lead">${esc(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }))}. Everything here is read live from Airtable.</p>
      <div class="banner ${need.length ? "y" : "g"}"><div><strong>${need.length ? need.length + " booking" + (need.length > 1 ? "s" : "") + " have items to check" : "Nothing flagged on active bookings"}</strong>Flags come from Airtable's own checks (missing info, schedule changes after approval, unpublished approvals, overdue follow-ups).</div></div>
      <div class="grid g4"><div class="kpi"><div class="n">${act.length}</div><div class="l">Active bookings</div></div><div class="kpi"><div class="n">${awaiting.length}</div><div class="l">Quoted, no accepted version</div></div><div class="kpi"><div class="n">${soon.length}</div><div class="l">Arriving within 60 days</div></div><div class="kpi"><div class="n">${need.length}</div><div class="l">Need attention</div></div></div>
      <h3 class="mt">Needs attention</h3>${need.length ? need.map(card).join("") : '<div class="card note">Nothing flagged.</div>'}
      <h3 class="mt">Next actions on file</h3><div class="card">${next.length ? next.map(b => `<div class="todo"><div class="s s-open">›</div><div><a class="lnk" onclick="REEF_UI.go('booking','${b.id}','overview')">${esc(b.g("org") || b.g("name"))}</a><div class="small">${esc(b.g("nextAction"))}${b.g("followUp") ? " · follow up " + esc(fmtD(b.g("followUp"))) : ""}</div></div></div>`).join("") : '<span class="note">No next actions recorded.</span>'}</div>`;
  }

  /* ---------- List ---------- */
  function list() {
    const q = S.q.toLowerCase();
    const rows = S.bookings.filter(b => {
      if (S.filter === "active" && (isDone(b) || isTest(b))) return false;
      if (S.filter === "done" && !isDone(b)) return false;
      if (S.filter === "test" && !isTest(b)) return false;
      return !q || [b.g("name"), b.g("org"), b.g("contact"), txt(b.g("status")), txt(b.g("type"))].join(" ").toLowerCase().includes(q);
    });
    return `<h2>All bookings</h2><div class="toolbar"><input id="q" type="search" placeholder="Search school, contact, status…" value="${esc(S.q)}" oninput="REEF_UI.setQ(this.value)">
      ${[["active", "Active"], ["done", "Completed / closed"], ["test", "Test (ZZZ)"], ["all", "All"]].map(f => `<button class="pill ${S.filter === f[0] ? "on" : ""}" onclick="REEF_UI.setFilter('${f[0]}')">${f[1]}</button>`).join("")}</div>
      <p class="note">${rows.length} booking${rows.length === 1 ? "" : "s"}</p>${rows.map(card).join("")}`;
  }

  /* ---------- Booking workspace ---------- */
  function booking() {
    const b = cur(); if (!b) return list();
    const fn = { overview, budget, vendors, program, comms, ready, contract, edit }[S.tab] || overview;
    const fl = flags(b);
    return `<h2>${esc(b.g("name"))}</h2><p class="lead">${esc(b.g("org") || "")} · ${chip("plan", txt(b.g("status")) || "—")} · <a class="lnk" target="_blank" rel="noopener" href="${atUrl(C.T.bookings, b.id)}">Open in Airtable</a></p>
      ${fl.map(f => `<div class="warn">${esc(f[1])}</div>`).join("")}${fn(b)}`;
  }
  const field = (k, v) => `<div class="field"><span class="k">${esc(k)}</span><span class="v">${v === "" || v == null ? "—" : v}</span></div>`;

  function overview(b) {
    const d = daysTo(b.g("arrival"));
    const appr = b.g("approved");
    return `<div class="grid g2">
      <div class="card"><h3>Program</h3>${field("Arrival", esc(fmtD(b.g("arrival"))) + (d != null ? ` <span class="note">(${d} days)</span>` : ""))}${field("Departure", esc(fmtD(b.g("departure"))))}${field("Location", esc(txt(b.g("location"))))}${field("Type", esc(txt(b.g("type"))))}${field("Grade level", esc(txt(b.g("grade"))))}${field("Students", esc(b.g("students")))}${field("Chaperones", esc(b.g("chaps")))}${field("Free chaperones", esc(b.g("freeChap")))}${field("REEF team aboard/on program", esc(b.g("teamTotal")))}${field("Full program days", esc(b.g("fullDays")))}${field("Campus sessions", esc(b.g("sessions")))}${field("Boat trips", esc(b.g("boatTrips")))}</div>
      <div class="card"><h3>Contact</h3>${field("Name", esc(b.g("contact")))}${field("Role", esc(b.g("role")))}${field("Email", b.g("email") ? `<a class="lnk" href="mailto:${esc(b.g("email"))}">${esc(b.g("email"))}</a>` : "")}${field("Phone", esc(b.g("phone")))}
        <h3 class="mt">Where it stands</h3>${field("Status", esc(txt(b.g("status"))))}${field("Proposal", esc(b.g("proposalSent") ? "Sent " + fmtD(b.g("proposalSent")) : "Not sent"))}${field("Response", esc(txt(b.g("response"))))}${field("Acceptance", esc(txt(b.g("acceptance"))))}${field("Agreement", esc(txt(b.g("agreementStatus"))))}${field("Payment", esc(txt(b.g("paymentStatus"))))}</div></div>
      <div class="card"><h3>Approval &amp; publishing</h3>${field("Approved to Share", appr ? chip("live", "Approved v" + (b.g("approvedVer") ?? "?")) : chip("notb", "Working draft"))}${field("Proposal version (current)", esc(b.g("propVer")))}${field("Published version (live page)", esc(b.g("publishedVer") ?? "none"))}${field("Last publish result", esc(txt(b.g("publishResult"))))}${field("Accepted by school", esc(b.g("acceptedVer") != null ? "v" + b.g("acceptedVer") : "Not accepted"))}
        <div class="note mt">${appr ? "Approved: changing headcount, dates, activities or price inputs will un-approve and alert Martha. To keep editing freely, start a new draft first." : "Working draft: edit freely. Nothing reaches the school until it is approved and published."}</div></div>
      <div class="card"><h3>Next steps</h3>${field("Next action", esc(b.g("nextAction")))}${field("Follow-up date", esc(fmtD(b.g("followUp"))))}${field("Rose: needs next", esc(txt(b.g("roseNeeds"))))}${field("Risk / missing info", esc(b.g("risk")))}
        <h3 class="mt">Notes</h3><div class="small">${esc(b.g("customerNotes") || "")}</div>${internal(`<div class="small mt"><b>Internal:</b> ${esc(b.g("internalNotes") || "—")}</div>`)}</div>`;
  }

  /* Budget & pricing */
  function inputsOf(b) {
    const people = (b.g("students") || 0) + (b.g("chaps") || 0), aboard = b.g("aboard") || people + (b.g("teamTotal") || 0);
    return { students: b.g("students") || 0, chaps: b.g("chaps") || 0, staff: Math.max(0, aboard - people) || (b.g("teamTotal") || 0), days: b.g("fullDays") || 0, arrDays: b.g("arrDepDays") || 0, sessions: b.g("sessions") || 0, trips: b.g("boatTrips") || 0, buses: b.g("buses") || 0, discountPct: b.g("discount") || 0, upliftPct: b.g("upliftOverride") == null ? null : b.g("upliftOverride"), addVendor: b.g("addVendor") || 0, materials: b.g("materialsFee") || 0, manualVendor: typeof b.g("manualVendorEst") === "number" ? b.g("manualVendorEst") : null, acts: txt(b.g("activities")) || "", model: txt(b.g("pricingModel")) || "", status: txt(b.g("status")) || "", arrival: b.g("arrival"), type: txt(b.g("type")) || "", freeChapOverride: typeof b.g("freeChapOverride") === "number" ? b.g("freeChapOverride") : null };
  }
  const noPrice = () => `<div class="warn">Pricing scenarios are unavailable: these Rate Keys were not found with numeric values in the Rates table: ${esc((S.pr && S.pr.missing || []).join(", "))}. Airtable's own price is still shown on the Overview.</div>`;
  /* One Vendors line, as in Airtable's Price Walkthrough. Gratuities are bundled and never shown separately (Martha 2026-11-07). */
  function priceLines(b) {
    const manual = typeof b.g("manualVendorEst") === "number", vend = (manual ? b.g("manualVendorEst") : (b.g("vendorAuto") || 0)) + (b.g("gratTotal") || 0) + (b.g("addVendor") || 0), mat = b.g("materialsFee") || 0;
    const lines = [["REEF program fees", b.g("progFees") || 0], ["REEF supplies", b.g("supplies") || 0], ["Campus facility fee", b.g("campusFee") || 0], ["Pennekamp entrance & boat", b.g("pennTotal") || 0], ["Vendors, incl. crew gratuities and additional vendor costs", vend]];
    if (mat) lines.push(["Materials fee", mat]);
    const sum = lines.reduce((t, l) => t + l[1], 0), st = b.g("subtotal"), gap = st == null ? null : Math.round((sum - st) * 100) / 100;
    return lines.map(l => `<tr><td>${l[0]}</td><td class="num">${money(l[1])}</td></tr>`).join("") + `<tr class="sub"><td>Subtotal</td><td class="num">${money(st)}</td></tr>
      <tr id="reconcile"><td colspan="2" class="${gap === 0 ? "note" : "warn"}">${gap === 0 ? "✓ Lines add up to the subtotal (" + money2(sum) + ")" : gap == null ? "Subtotal not available to reconcile." : "Lines add to " + money2(sum) + " but Airtable's subtotal is " + money2(st) + " (difference " + money2(gap) + "). Use Airtable's figure and tell Martha."}${manual ? ' <span class="note">Vendors uses the manual Estimated Vendor Cost instead of the automatic vendor calculation.</span>' : ""}</td></tr>` +
      [["Uplift", "uplift"], ["Discount", "discountAmt"], ["Sales tax", "tax"]].map(r => `<tr><td>${r[0]}</td><td class="num">${money(b.g(r[1]))}</td></tr>`).join("");
  }
  function budget(b) {
    if (!P.isReady()) return noPrice();
    const base = inputsOf(b), cur0 = P.calc(base, {});
    const diff = Math.round((cur0.total - (b.g("total") || 0)) * 100) / 100, model = txt(b.g("pricingModel")) || "";
    const matches = cur0.supported && Math.abs(diff) < 0.005;
    const ref = [["Proposed total (this booking)", b.g("total")], ["Prior-year signed price", b.g("priorSigned")], ["Previously quoted to school", b.g("prevQuoted")], ["Historical total (reference)", b.g("histTotal")]];
    return `<div class="grid g2"><div class="card"><h3>Price the school sees ${chip("live", "LIVE")}</h3><table>
      ${priceLines(b)}
      <tr class="tot"><td>Total package price</td><td class="num">${money(b.g("total"))}</td></tr><tr><td class="note">Per paid space</td><td class="num note">${money2(b.g("perPaid"))}</td></tr></table>
      <div class="note mt">Pricing model: ${esc(model || "—")}. Free chaperones: ${esc(b.g("freeChap") ?? "—")}.</div></div>
      <div class="card"><h3>Compare with history</h3><table>${ref.map(r => `<tr><td>${r[0]}</td><td class="num">${money(r[1])}</td></tr>`).join("")}
      ${b.g("priorSigned") ? `<tr class="sub"><td>Change vs prior-year signed</td><td class="num">${money((b.g("total") || 0) - b.g("priorSigned"))} (${(((b.g("total") || 0) / b.g("priorSigned") - 1) * 100).toFixed(1)}%)</td></tr>` : ""}</table>
      <div class="note mt">${esc(b.g("priorSource") || "")}</div>
      <div class="warn">Actual vendor costs are not recorded in the system yet, so proposed-vs-actual cannot be shown. It needs the Booking Vendor Lines table (see Vendor Options).</div></div></div>
      ${internal(`<div class="card"><h3>Internal cost &amp; margin ${chip("proto", "PRICING VIEW")}</h3><div class="grid g4"><div class="kpi"><div class="n">${money(b.g("totalCost"))}</div><div class="l">Total program cost</div></div><div class="kpi"><div class="n">${money(b.g("margin"))}</div><div class="l">Margin $</div></div><div class="kpi"><div class="n">${b.g("marginPct") == null ? "—" : Number(b.g("marginPct")).toFixed(1) + "%"}</div><div class="l">Margin %</div></div><div class="kpi"><div class="n">${money(b.g("netIncome"))}</div><div class="l">Net income</div></div></div>
        <table class="mt"><tr><td>Staff labor</td><td class="num">${money(b.g("staffLabor"))}</td></tr><tr><td>Campus facility (internal)</td><td class="num">${money(b.g("campusCost"))}</td></tr><tr><td>Direct expenses</td><td class="num">${money(b.g("directExp"))}</td></tr><tr><td>Mileage</td><td class="num">${money(b.g("mileage"))}</td></tr><tr><td>Materials actual</td><td class="num">${money(b.g("materialsActual"))}</td></tr></table></div>`)}
      <div class="card"><h3>What-if scenario ${chip("proto", "READ-ONLY")}</h3>
        <div class="${matches ? "banner g" : "banner y"}"><div><strong>${matches ? "Mirror matches Airtable for this booking" : "Mirror out of date, use Airtable's figure (differs by " + money2(diff) + ")"}</strong>${matches ? "The scenario below uses a copy of Airtable's formulas that reproduces the stored total exactly." : (cur0.supported ? "" : "Not modeled here: " + cur0.unsupported.join(", ") + ". ") + "Use Airtable's figure. Discounts, tax, a discovery pricing model or a custom input may not be modeled here. Scenario deltas are shown relative to the mirror, not the stored price."}</div></div>
        <div class="grid g4" id="wi">${[["students", "Students"], ["chaps", "Chaperones"], ["days", "Full program days"], ["sessions", "Campus sessions"], ["trips", "Boat trips"], ["buses", "Buses"]].map(k => `<label class="ctl">${k[1]}<input type="number" min="0" data-k="${k[0]}" value="${base[k[0]]}"></label>`).join("")}</div>
        <div id="wiOut" class="mt"></div><p class="note">Nothing here is saved. It does not change Airtable or what the school sees.</p></div>`;
  }
  function wireBudget() {
    const b = cur(), base = inputsOf(b), baseCalc = P.calc(base, {});
    const out = () => {
      const i = Object.assign({}, base); document.querySelectorAll("#wi input").forEach(e => { i[e.dataset.k] = +e.value || 0; e.parentElement.classList.toggle("chg", i[e.dataset.k] !== base[e.dataset.k]); });
      const r = P.calc(i, {}), dd = r.total - baseCalc.total;
      $("wiOut").innerHTML = `<table><tr><td>Paid spaces</td><td class="num">${r.paid}</td><td class="note">(${r.freeChap} free)</td></tr><tr><td>Program fees + supplies</td><td class="num">${money(r.prog + r.sup)}</td><td></td></tr><tr><td>Campus</td><td class="num">${money(r.camp)}</td><td></td></tr><tr><td>Boat departures (${r.perBoat} per trip, capacity ${r.cap})</td><td class="num">${r.departures} × ${money(r.rate)} = ${money(r.boats)}</td><td></td></tr><tr><td>Vendors total</td><td class="num">${money(r.vendors)}</td><td></td></tr><tr class="tot"><td>Scenario total</td><td class="num">${money(r.total)}</td><td class="num ${dd > 0 ? "delta-up" : "delta-dn"}">${dd === 0 ? "no change" : (dd > 0 ? "+" : "") + money(dd)}</td></tr></table>`;
    };
    document.querySelectorAll("#wi input").forEach(e => e.oninput = out); out();
  }

  /* Vendors */
  function ratesOf(vrec) { return S.data.rates.filter(r => (r.fields[D.FX.rates.vendor] || []).includes(vrec.id)); }
  const rateVal = r => { const f = r.fields, X = D.FX.rates; return f[X.cur] != null ? f[X.cur] : (f[X.num] != null ? f[X.num] : null); };
  function vendors(b) {
    if (!P.isReady()) return noPrice();
    const X = D.FX.vendors, XR = D.FX.rates, base = inputsOf(b), r0 = P.calc(base, {});
    const vs = S.data.vendors.filter(v => /boat|charter|dive|snorkel|kayak|marine/i.test(txt(v.fields[X.cat]) || "") || /boat|dive|princess|ocean/i.test(v.fields[X.name] || ""));
    const mote = S.data.vendors.filter(v => /mote/i.test(v.fields[X.name] || "") && !vs.includes(v)); vs.push(...mote);
    S.vlist = vs;
    return `<div class="card"><h3>Boat / snorkel scenario ${chip("proto", "READ-ONLY")}</h3>
      ${r0.manual ? `<div class="banner b"><div><strong>This booking uses the manual Estimated Vendor Cost (${money(base.manualVendor)}).</strong>The scenario below is shown as a change relative to that estimate, not recomputed from zero boats.</div></div>` : ""}
      ${r0.gearIncluded ? '<div class="note">Snorkel gear is included in the Pennekamp boat fee, so the scenario adds no separate gear charge (Martha 2026-11-05). Airtable\'s automatic vendor formula still adds gear when no manual estimate is set; that is Airtable\'s figure, not changed here.</div>' : ""}
      <p class="note">Separate the questions: how many vessels a vendor has, how many people each carries, how many departures your group needs, and what the vendor actually quotes. Today's price uses the Rates-table defaults (${money(P.R.boatRate)} per departure, ${P.R.boatCap} aboard, ${P.R.vessels ?? "?"} vessels on file), not a quote for this group.</p>
      <div class="grid g4"><label class="ctl">Vendor<select id="vSel"><option value="">Current default rates (from Rates table)</option>${vs.map(v => `<option value="${v.id}">${esc(v.fields[X.name])}</option>`).join("")}</select></label>
        <label class="ctl">Capacity per vessel (people)<input id="vCap" type="number" min="0" value="${P.R.boatCap}"></label>
        <label class="ctl">Vessels available that day<input id="vVes" type="number" min="0" placeholder="unknown" value="${P.R.vessels ?? ''}"></label>
        <label class="ctl">Quote per departure ($)<input id="vRate" type="number" min="0" value="${P.R.boatRate}"></label>
        <label class="ctl">Snorkel gear ($/person)<input id="vGear" type="number" min="0" value="${r0.gearIncluded ? 0 : P.R.gear}"></label>
        <label class="ctl">Gratuity ($/person/trip)<input id="vGrat" type="number" min="0" value="${P.R.gratuity}"></label>
        <label class="ctl">Quote status<select id="vStat"><option>Assumption</option><option>Requested</option><option>Quoted</option><option>Confirmed</option></select></label></div>
      <div id="vOut" class="mt"></div></div>
      <div class="card"><h3>Vendor lines for this booking</h3>${vlinesCard(b)}</div>
      ${activityRates(vs)}
      <h3>Vendors on file</h3>${vs.map(v => { const rs = ratesOf(v); return `<div class="card"><b>${esc(v.fields[X.name])}</b> ${chip("plan", txt(v.fields[X.status]) || "—")} ${v.fields[X.review] ? chip("notb", txt(v.fields[X.review])) : ""}
        <div class="small">${esc(txt(v.fields[X.cat]))} · lead time ${esc(v.fields[X.leadDays] ?? "—")} days · confirmed ${esc(fmtD(v.fields[X.confirmedOn]))}</div>
        ${rs.length ? `<table class="mt"><tr><th>Rate</th><th class="num">Value</th><th>Status</th><th>Availability</th><th>Confirmed</th></tr>${rs.map(r => `<tr><td>${esc(r.fields[XR.name] || r.fields[XR.key])}</td><td class="num">${rateVal(r) == null ? "—" : esc(rateVal(r))}</td><td>${esc(txt(r.fields[XR.status]))}</td><td>${esc(txt(r.fields[XR.avail]))}</td><td>${esc(fmtD(r.fields[XR.confirmedOn]))}</td></tr>`).join("")}</table>` : '<div class="note mt">No rates on file.</div>'}
        <div class="small mt">${esc(v.fields[X.actions] || "")}</div></div>`; }).join("")}`;
  }
  function activityRates(vs) {
    const XR = D.FX.rates, rows = S.data.rates.filter(r => /mote/i.test(String(r.fields[XR.key] || "")) && !(vs || []).some(v => ratesOf(v).includes(r)));
    if (!rows.length) return "";
    return `<h3>Activity rates</h3><div class="card"><table><tr><th>Rate</th><th class="num">Value</th><th>Unit</th></tr>${rows.map(r => `<tr><td>${esc(r.fields[XR.name] || r.fields[XR.key])}</td><td class="num">${rateVal(r) == null ? "—" : money(rateVal(r))}</td><td>${esc(txt(r.fields[XR.unit]) || "")}</td></tr>`).join("")}</table><div class="note">No vendor record exists for this activity yet, so the rate is shown here instead of under Vendors on file.</div></div>`;
  }
  function wireVendors() {
    const b = cur(), base = inputsOf(b), r00 = P.calc(base, {}), X = D.FX.vendors, XR = D.FX.rates, r0 = r00, gd = r00.gearIncluded ? 0 : P.R.gear;
    const val = id => { const e = $(id).value; return e === "" ? null : +e; };
    const out = () => {
      const v = { capacity: val("vCap"), vessels: val("vVes"), rate: val("vRate"), gear: val("vGear"), grat: val("vGrat"), baseGear: gd };
      const r = P.calc(base, v), dd = r.total - (r00.manual ? P.calc(base, { gear: gd, baseGear: gd }).total : r00.total), st = $("vStat").value;
      $("vOut").innerHTML = `<table><tr><td>People aboard per trip</td><td class="num">${r.aboard}</td></tr><tr><td>Departures required (${r.perBoat} per trip × ${Math.max(1, base.trips)} trip${Math.max(1, base.trips) === 1 ? "" : "s"}${base.trips === 0 ? ", Airtable counts 0 trips as 1" : ""})</td><td class="num">${r.departures}</td></tr>
        ${r.manual ? `<tr><td colspan="2" class="note">The manual vendor estimate ${money(base.manualVendor)} is the starting point.</td></tr>` : ""}
        <tr><td>Vessels available</td><td class="num">${r.vessels == null ? "not entered" : r.vessels}</td></tr>
        <tr><td>Sailing windows needed with those vessels</td><td class="num">${r.waves == null ? "enter vessels available" : r.waves + (r.waves > base.trips ? " (more than the " + base.trips + " window(s) planned: check the schedule)" : " (fits)")}</td></tr>
        <tr><td>Boat charter cost</td><td class="num">${r.departures} × ${money(r.rate)} = ${money(r.boats)}</td></tr><tr><td>${r.gearIncluded && v.gear === 0 ? "Gear (included in Pennekamp boat fee) + gratuities" : "Gear + gratuities"}</td><td class="num">${money(r.gearC + r.gr)}</td></tr>
        <tr class="tot"><td>Scenario total (mirror)</td><td class="num">${money(r.total)} <span class="${dd > 0 ? "delta-up" : "delta-dn"}">${dd === 0 ? "" : (dd > 0 ? "+" : "") + money(dd)}</span></td></tr></table>
        ${r.incomplete.length ? `<div class="warn">Missing: ${esc(r.incomplete.join(", "))}. No total is valid until these are entered. Do not guess a rate.</div>` : ""}
        <div class="note">Quote status: <b>${esc(st)}</b>. ${st === "Assumption" ? "This is a planning assumption, not a vendor quote." : ""} Saving quotes needs the Booking Vendor Lines table (not built; changes the live schema, needs approval).</div>`;
    };
    $("vSel").onchange = () => {
      const v = S.vlist.find(x => x.id === $("vSel").value);
      if (!v) { $("vCap").value = P.R.boatCap; $("vRate").value = P.R.boatRate; $("vGear").value = r0.gearIncluded ? 0 : P.R.gear; $("vGrat").value = P.R.gratuity; $("vVes").value = P.R.vessels ?? ""; $("vStat").value = "Assumption"; }
      else { const rs = ratesOf(v).map(rateVal).filter(x => x != null); $("vRate").value = rs.length === 1 ? rs[0] : ""; $("vCap").value = ""; $("vGear").value = ""; $("vGrat").value = ""; $("vVes").value = ""; $("vStat").value = "Assumption"; }
      out();
    };
    ["vCap", "vVes", "vRate", "vGear", "vGrat", "vStat"].forEach(id => $(id).oninput = out); out();
  }

  /* Program & itinerary */
  function program(b) {
    const X = D.FX.schedule, WG = "Whole group", coh = r => { const c = txt(r[X.cohort]); return !c || /^all$/i.test(c) ? WG : c; };
    const rows = b.schedule.map(r => r.fields).sort((a, c) => (a[X.day] || 0) - (c[X.day] || 0) || mins(a[X.startHM]) - mins(c[X.startHM]));
    const days = {}; rows.forEach(r => { const d = r[X.day] || 1, c = coh(r); ((days[d] = days[d] || {})[c] = days[d][c] || []).push(r); });
    const nCoh = new Set(rows.map(coh).filter(c => c !== WG)).size;
    const bad = rows.filter(r => r[X.rowCheck] && !/^ok/i.test(String(r[X.rowCheck])));
    const XI = D.FX.itin;
    const dep = r => !r[X.endHM] && /depart/i.test(r[X.name] || "");
    const when = r => r[X.endHM] ? `${esc(fmt12(r[X.startHM]))}–${esc(fmt12(r[X.endHM]))}` : dep(r) ? `Departure ${esc(fmt12(r[X.startHM]))}` : esc(fmt12(r[X.startHM]));
    return `<div class="card"><h3>Schedule ${chip("live", "LIVE")}</h3><div class="note">${rows.length} block${rows.length === 1 ? "" : "s"} · ${nCoh} cohort${nCoh === 1 ? "" : "s"} · ${esc(txt(b.g("rotation")) || "")}. Edit blocks in Airtable's Schedule Items (editing here comes after the edit controls are verified).</div>
      ${bad.length ? `<div class="warn">${bad.length} block(s) fail Airtable's row check: ${esc(bad.map(r => r[X.rowCheck]).join("; "))}</div>` : ""}</div>
      ${rows.length ? Object.keys(days).map(d => `<div class="card"><h3>Day ${esc(d)}</h3><div class="grid g4">${Object.keys(days[d]).sort((p, q) => (p === WG ? -1 : q === WG ? 1 : p.localeCompare(q))).map(c => `<div><b>${c === WG ? WG : "Cohort " + esc(c)}</b><div class="coh">${days[d][c].map(r => `<div class="slot ${/meal|lunch/i.test(txt(r[X.type]) || "") ? "meal" : /boat|gbb|glass/i.test(r[X.name] || "") ? "gbb" : "act"}"><b>${when(r)}</b>${dep(r) ? "" : " " + esc(r[X.name] || "")}<div class="note">${esc(r[X.loc] || "")}</div></div>`).join("")}</div></div>`).join("")}</div></div>`).join("") : '<div class="card note">No schedule blocks yet.</div>'}
      <div class="card"><h3>Itinerary stations</h3>${b.itin.length ? b.itin.map(r => `<div class="field"><span class="k">${esc(r.fields[XI.label] || "")}</span><span class="v">${esc(r.fields[XI.name] || "")}</span></div>`).join("") : '<span class="note">None.</span>'}</div>`;
  }

  /* Communications */
  function comms(b) {
    const X = D.FX.comms, rows = b.comms.map(r => r.fields).sort((a, c) => String(c[X.date] || "").localeCompare(String(a[X.date] || "")));
    const chs = b.changes.map(r => r.fields), XC = D.FX.changes;
    return `<div class="card"><h3>Communications log ${chip("live", "LIVE")}</h3>${rows.length ? rows.map(r => `<div class="todo"><div class="s s-done">✉</div><div><b>${esc(r[X.summary] || "")}</b><div class="small">${esc(fmtD(r[X.date]))} · ${esc(txt(r[X.dir]))} · ${esc(txt(r[X.what]))}${r[X.ver] ? " · v" + esc(r[X.ver]) : ""}</div><div class="small">${esc(r[X.details] || "")}</div></div></div>`).join("") : '<span class="note">Nothing logged yet. Rose logs sends here; add entries in Airtable until writes are enabled.</span>'}
      <div class="note mt">New entries: add in Airtable for now. Adding a log entry is the first write planned (append-only, lowest risk).</div></div>
      <div class="card"><h3>Change requests from the school</h3>${chs.length ? chs.map(r => `<div class="todo"><div class="s ${/applied|done/i.test(txt(r[XC.status]) || "") ? "s-done" : "s-open"}">!</div><div><b>${esc(r[XC.summary] || txt(r[XC.type]))}</b><div class="small">${esc(txt(r[XC.status]))} · ${esc(fmtD(r[XC.submitted]))}</div><div class="small">${esc(r[XC.details] || r[XC.reason] || "")}</div></div></div>`).join("") : '<span class="note">None.</span>'}</div>`;
  }

  /* Get ready */
  function ready(b) {
    const X = D.FX.checklist, rows = b.checklist.map(r => r.fields), done = rows.filter(r => r[X.done]).length;
    return `<div class="card"><h3>Get-ready checklist ${chip("live", "LIVE")}</h3><div class="bar"><i style="width:${rows.length ? done / rows.length * 100 : 0}%"></i></div><div class="note">${done} of ${rows.length} done</div>
      ${rows.map(r => `<div class="todo"><div class="s ${r[X.done] ? "s-done" : "s-open"}">${r[X.done] ? "✓" : "·"}</div><div>${esc(r[X.item] || r[X.key])}<div class="small">${r[X.done] ? "Done " + esc(fmtD(r[X.doneOn])) + (r[X.doneBy] ? " by " + esc(r[X.doneBy]) : "") : ""}</div></div></div>`).join("") || `<span class="note">No checklist items yet. Add them in Airtable's <a class="lnk" target="_blank" rel="noopener" href="${atUrl(C.T.checklist, "")}">Get-ready checklist</a> until writes are enabled.</span>`}</div>`;
  }

  /* Contracts & payments */
  function contract(b) {
    const proj = !b.g("agreementDate"), d1 = b.g("depositDue"), d2 = b.g("pay2Due");
    return `<div class="card"><h3>Agreement terms ${chip("live", "LIVE")}</h3>
      ${proj ? '<div class="warn"><b>Projected dates.</b> No Agreement Date is entered, so dates that run from signing (deposit, Payment 2, and for later tiers the lock date) are calculated from today and move daily until the Agreement Date is recorded.</div>' : ""}
      ${field("Contract tier", esc(b.g("tier")))}${field("Payment tier (legacy label)", esc(b.g("payTier")))}${field("Agreement date", esc(fmtD(b.g("agreementDate"))))}
      ${field("Agreement deposit (20% unless overridden)", "<b>" + money2(b.g("depositAmt")) + "</b> due " + esc(fmtD(d1)))}${field("Payment 2", b.g("pay2Amt") == null ? "none for this tier" : money2(b.g("pay2Amt")) + " due " + esc(fmtD(d2)))}
      ${d1 && d2 && String(d1).slice(0, 10) === String(d2).slice(0, 10) ? '<div class="note">Deposit and Payment 2 share a date. For the middle tier (90 to 180 days out) the agreement spec sets both at Agreement Date + 14. This is by design, not a calculation error.</div>' : ""}
      ${field("Final payment", b.g("finalAmt") == null ? "—" : money2(b.g("finalAmt")) + " due " + esc(fmtD(b.g("finalDue"))))}
      ${field("Guarantee lock date", esc(fmtD(b.g("lockDate"))))}${field("Minimum guaranteed paid spaces (85%)", esc(b.g("minGuarSpaces")))}${field("Guaranteed program cost", money2(b.g("guarCost")))}${field("Final roster due", esc(fmtD(b.g("rosterDue"))))}
      ${paymentsReconcile(b)}
      ${b.g("depositNow") != null ? `<details class="why"><summary>Legacy field</summary><div class="small">Legacy 'Deposit Due Now': ${money(b.g("depositNow"))}. Old flat deposit, kept for reference; the agreement deposit above is the figure to use.</div></details>` : ""}</div>
      <div class="card"><h3>Published versions</h3>${versionsTable(b)}</div>
      <div class="card"><h3>Acceptance</h3>${field("Acceptance status", esc(txt(b.g("acceptance"))))}${field("Accepted proposal version", esc(b.g("acceptedVer") ?? "—"))}${field("Current proposal version", esc(b.g("propVer")))}</div>`;
  }

  function paymentsReconcile(b) {
    const t = b.g("total"), d = b.g("depositAmt"), p2 = b.g("pay2Amt") || 0, fin = b.g("finalAmt");
    if (t == null || d == null || fin == null) return "";
    const sum = d + p2 + fin, gap = Math.round((t - sum) * 100) / 100;
    if (Math.abs(gap) < 0.005) return `<div class="note" id="payrec">✓ Deposit + Payment 2 + Final = ${money2(sum)}, equal to the total package price.</div>`;
    const legacy = b.g("depositNow"), explained = legacy != null && Math.abs(gap - legacy / 2) < 0.01;
    return `<div class="warn" id="payrec"><b>Payments do not add up to the total.</b> Deposit ${money2(d)} + Payment 2 ${money2(p2)} + Final ${money2(fin)} = ${money2(sum)}, which is ${money2(Math.abs(gap))} ${gap > 0 ? "less" : "more"} than the total ${money2(t)}. ${explained ? `Cause: Airtable's Final Payment formula still works from the legacy flat deposit (${money(legacy)}): Final = (Total − ${money(legacy)}) × 50%, while the deposit and Payment 2 use 20% and 50% of the total. That is half the legacy deposit, so it does not look intentional. Flagged for Martha; not corrected here.` : "Cause not identified from the stored fields. Flagged for Martha; not corrected here."}</div>`;
  }
  function vlinesCard(b) {
    if (S.data.optionalMissing && S.data.optionalMissing.includes("vlines")) return '<div class="note">The Booking Vendor Lines table could not be read with this token, so quotes cannot be shown here. The boat cost on this booking still comes from the default rate.</div>';
    const XL = D.FX.vlines, rows = b.vlines.map(r => r.fields);
    if (!rows.length) return '<div class="note">No vendor lines recorded for this booking yet. The boat cost still comes from the default rate (8 charters at the Rates-table price is an estimate, not a quote). Add a line in Airtable (Booking Vendor Lines) with vessels available, capacity per vessel and the quote per departure, and it will show here.</div>';
    return `<table><tr><th>Line</th><th>Type</th><th>Status</th><th class="num">Vessels</th><th class="num">Capacity</th><th class="num">Quote / departure</th><th class="num">Per person</th><th>Quote date</th></tr>${rows.map(r => `<tr><td>${esc(r[XL.name] || "")}</td><td>${esc(txt(r[XL.type]))}</td><td>${esc(txt(r[XL.status]))}</td><td class="num">${esc(r[XL.vessels] ?? "—")}</td><td class="num">${esc(r[XL.cap] ?? "—")}</td><td class="num">${r[XL.quote] != null ? money(r[XL.quote]) : "—"}</td><td class="num">${r[XL.perPerson] != null ? money(r[XL.perPerson]) : "—"}</td><td>${esc(fmtD(r[XL.date]))}</td></tr>`).join("")}</table><div class="note">Display only for now. These lines do not change the price until the pricing mirror is switched to read them.</div>`;
  }

  function versionsTable(b) {
    const XV = D.FX.versions, rows = b.versions.map(r => r.fields).sort((a, c) => (a[XV.version] || 0) - (c[XV.version] || 0));
    if (!rows.length) return '<span class="note">No versions recorded yet. This ledger fills in once the publish workflow writes one row per publish (planned: accepted-version display).</span>';
    const acc = b.g("acceptedVer");
    return `<table><tr><th>Version</th><th class="num">Total</th><th class="num">Students</th><th>Arrival</th><th>Published</th><th></th></tr>${rows.map(r => `<tr><td>v${esc(r[XV.version])}</td><td class="num">${money(r[XV.total])}</td><td class="num">${esc(r[XV.students] ?? "—")}</td><td>${esc(fmtD(r[XV.arrival]))}</td><td>${esc(fmtD(r[XV.at]))}</td><td>${acc != null && acc === r[XV.version] ? chip("live", "Accepted") : ""}</td></tr>`).join("")}</table>`;
  }

  /* Edit preview (dry-run) */
  function edit(b) {
    const ks = Object.keys(C.EDITABLE), appr = b.g("approved");
    return `<div class="card"><h3>Edit preview ${chip("proto", "DRY RUN")}</h3>
      <div class="banner b"><div><strong>Nothing is saved from this screen.</strong>It shows what a change would do, checks it, and shows the approval impact. Real saving stays off until the permission, validation and change-tracking checks pass on test records.</div></div>
      ${appr ? '<div class="warn">This booking is Approved to Share. Fields marked ⚠ would un-approve it.</div>' : '<div class="note">Working draft: editing does not trigger approval resets.</div>'}
      <div class="grid g3">${ks.map(k => `<label class="ctl">${esc(C.EDITABLE[k].label)}${C.EDITABLE[k].watched ? " ⚠" : ""}<input data-e="${k}" value="${esc(b.raw[F[k]] == null ? "" : b.raw[F[k]])}"></label>`).join("")}</div>
      <p><button class="btn" id="prev">Preview changes</button></p><div id="planOut"></div></div>
      ${appr ? `<div class="card"><h3>Start a new draft ${chip("plan", "PLANNED")}</h3><p class="small">To revise this approved booking without surprise resets: un-approve once on purpose, bump the Proposal Version from v${esc(b.g("propVer"))} to v${esc((b.g("propVer") || 0) + 1)}, edit freely, then approve once when ready. The school's live page stays up until you republish. This is not enabled yet; today, un-check Approved to Share in Airtable first.</p></div>` : ""}`;
  }
  function wireEdit() {
    const b = cur();
    $("prev").onclick = () => {
      const ch = {}; document.querySelectorAll("[data-e]").forEach(e => { const k = e.dataset.e, orig = b.raw[F[k]] == null ? "" : String(b.raw[F[k]]); if (e.value !== orig) ch[k] = e.value; });
      const p = E.plan(b, ch);
      $("planOut").innerHTML = !Object.keys(ch).length ? '<div class="note">No changes entered.</div>' : `
        ${Object.keys(p.errors).map(k => `<div class="warn">${esc((C.EDITABLE[k] || {}).label || k)}: ${esc(p.errors[k])}</div>`).join("")}
        ${p.diff.length ? `<table class="diff"><tr><th>Field</th><th>Now</th><th>Would become</th></tr>${p.diff.map(d => `<tr><td>${esc(d.label)}${d.watched ? " ⚠" : ""}</td><td class="bf">${esc(d.before == null ? "(blank)" : d.before)}</td><td class="af">${esc(d.after == null ? "(blank)" : d.after)}</td></tr>`).join("")}</table>` : ""}
        ${p.warnings.map(w => `<div class="warn">${esc(w)}</div>`).join("")}
        <div class="note mt">Change log that would be written: <i>${esc(p.logEntry.summary)}</i>. Concurrency check: the record must be unchanged since ${esc(p.baseModified || "load")}.</div>
        <p><button class="btn" disabled title="${esc(p.writeBlockedBy || "")}">Save to Airtable</button> <span class="note">${esc(p.writeBlockedBy || "")}${p.isTestRecord ? "" : " Real bookings stay read-only even after writes are enabled until test records pass."}</span></p>`;
    };
  }

  /* New booking / EPO */
  function newBooking() {
    return `<h2>New booking / EPO inquiry</h2><p class="lead">Bookings are created through the established EPO workflow so the school, contact and inquiry stay linked. This screen does not create records yet.</p>
      <div class="card"><h3>How a booking starts today</h3><ol><li>Inquiry and organization are recorded in the EPO base.</li><li>When the inquiry is marked <b>Ready for REEF Bookings</b>, the Zapier flow creates the Booking with its EPO record ID and contact.</li><li>Rose completes program details, then the proposal is approved and published.</li></ol>
      <div class="note">Bookings with an EPO Record ID are linked to their inquiry. Bookings without one were created by hand.</div></div>
      <div class="card"><h3>Created from an inquiry (read-only list)</h3>${S.bookings.filter(b => b.g("epoId") && !isDone(b)).map(b => `<div class="field"><span class="k"><a class="lnk" onclick="REEF_UI.go('booking','${b.id}','overview')">${esc(b.g("org") || b.g("name"))}</a></span><span class="v">${esc(txt(b.g("status")))}</span></div>`).join("") || '<span class="note">None.</span>'}</div>
      <div class="card"><h3>Planned</h3><p>Convert-an-inquiry screen: pick an EPO inquiry marked ready, preview the Booking it would create, create it on a test record first. Needs read access to the EPO base on the token and Martha's go-ahead on the creation path.</p></div>`;
  }

  /* ---------- help drawer ---------- */
  function help() {
    $("drawer").innerHTML = `<button class="btn alt" onclick="document.getElementById('drawer').classList.remove('open')">Close</button><h3 class="mt">Help</h3>
      <p><b>What this is.</b> One workspace for bookings, pricing, vendors, program and next steps, reading live from Airtable.</p>
      <p><b>What works now.</b> Search and open every booking, see full details, the price breakdown and history, scenarios (nothing saved), vendors and rates, schedule, communications, checklist, contract dates, and a dry-run edit preview.</p>
      <p><b>What does not work yet.</b> Saving changes, creating bookings, saving vendor quotes. These stay off until verified on test records.</p>
      <p><b>Your token.</b> Stays in this browser tab. Disconnect clears it. If you see a 401 or 403, the token is missing the <i>data.records:read</i> scope or this base.</p>
      <p><b>Staff view vs Pricing view.</b> A display setting. Anyone with a token can read the whole base. Real separation needs separate tokens/accounts or a server.</p>
      <p><b>Troubleshooting.</b> 401: token wrong or expired. 403/404: no access to the base. 429: Airtable is rate limiting; wait a moment and Refresh.</p>`;
    $("drawer").classList.add("open");
  }

  /* ---------- boot ---------- */
  let timer = null;
  function schedule() { clearInterval(timer); if (S.auto && S.data) timer = setInterval(() => load(true), window.REEF_REFRESH_MS || 300000); }
  /* silent=true: re-read without leaving the page, keeping the selected booking/tab and the in-memory token. */
  async function load(silent) {
    silent = silent === true && !!S.data;
    if (!silent) { $("gate").hidden = true; $("app").hidden = false; $("main").innerHTML = '<div class="card"><h3>Loading bookings…</h3><div id="prog" class="note"></div></div>'; }
    try {
      S.caps = await D.verify();
      const data = await D.loadAll(silent ? null : (n, c) => { const p = $("prog"); if (p) p.textContent = n + ": " + c + " records"; });
      S.data = data; S.loadErr = null; S.pr = P.load(S.data.rates); build(S.data); $("roleSel").value = S.role;
      if (silent) { const y = window.scrollY, ae = document.activeElement; if (ae && ae.matches && ae.matches("#main input, #main select")) statusbar(); else { render(); window.scrollTo(0, y); } } else render();
      schedule();
    } catch (e) { if (silent) { S.loadErr = e.message; statusbar(); } else fail(e); }
  }
  function fail(e) {
    $("app").hidden = true; $("gate").hidden = false;
    $("err").textContent = (e.status === 401 ? "That token was not accepted (401). Check it and try again." : e.status === 403 || e.status === 404 ? "This token cannot read the REEF Bookings base (" + e.status + "). It needs data.records:read on that base." : "Could not load: " + e.message);
  }
  $("go").onclick = () => { const t = $("tok").value.trim(); if (!t) { $("err").textContent = "Paste your token first."; return; } $("err").textContent = ""; D.setToken(t, $("rem").checked); $("tok").value = ""; load(); };
  $("tok").addEventListener("keydown", e => { if (e.key === "Enter") $("go").click(); });
  $("refresh").onclick = () => load(true); $("help").onclick = help;
  $("disc").onclick = () => { clearInterval(timer); D.clear(); S.data = null; S.bookings = []; S.bid = null; $("app").hidden = true; $("gate").hidden = false; };
  $("roleSel").onchange = e => { S.role = e.target.value; render(); };
  if (D.restore()) load();
})();
