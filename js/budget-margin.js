/* REEF Booking Program Manager: Budget & Margin panel (INTERNAL, read-only).
   Shows, for the open booking and its sibling options side by side: what the school pays, hard costs line by line WITH
   how each line is built (quantity x rate), staff and campus cost, and net dollars and percent.
   Totals are always Airtable's own formula results (Program Revenue, Total Program Cost, Program Margin $/%). The
   "how it is built" lines are an explanation computed from the same Rates table; a breakdown is shown only when it
   reproduces Airtable's number to within $1, otherwise the line shows Airtable's figure alone. It never writes, and it
   never touches reef-program-pages.
   The "Pricing & costs view" gate hides it from the Staff view as a courtesy; it is NOT access control (a token can read
   every field in the base).
   Hook: app.js calls ReefBudgetMargin.html({...}) from a tab function. */
window.ReefBudgetMargin = (function () {
  let pickedId = null;                       // booking the user chose in "Compare with"
  const MAX_COLS = 4;

  const CSS = `
  .bm .bm-wrap{overflow-x:auto}
  .bm table.bmt{width:100%;border-collapse:collapse;min-width:520px}
  .bm table.bmt th{font-size:12px;text-align:right;color:var(--mute);font-weight:600;padding:6px 10px;border-bottom:2px solid var(--line);vertical-align:bottom}
  .bm table.bmt th:first-child{text-align:left}
  .bm table.bmt th .h1{display:block;color:var(--navy);font-size:13px}
  .bm table.bmt td{padding:6px 10px;border-bottom:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums;vertical-align:top}
  .bm table.bmt td:first-child{text-align:left}
  .bm table.bmt td small{display:block;color:var(--mute);font-size:11.5px;font-weight:400}
  .bm table.bmt tr.grp td{background:var(--sand);font-weight:700;color:var(--navy);text-align:left;font-size:12px;letter-spacing:.4px;text-transform:uppercase;border-bottom:1px solid var(--line)}
  .bm table.bmt tr.sub td{font-weight:600;background:#fafcfd}
  .bm table.bmt tr.det td{font-size:12.5px;color:#455}
  .bm table.bmt tr.det td:first-child{padding-left:28px}
  .bm table.bmt tr.net td{font-weight:700;font-size:15px;background:var(--teal-l);border-top:2px solid var(--teal)}
  .bm td.neg{color:var(--red)}.bm td.pos{color:var(--green)}
  .bm td.dlt{background:#fafcfd;color:var(--mute)}
  .bm .kpis{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin:10px 0 4px}
  .bm .kpi2{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:#fff}
  .bm .kpi2 .n{font-size:20px;font-weight:700;color:var(--navy)}.bm .kpi2 .l{font-size:12px;color:var(--mute)}
  .bm .pick{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0 12px;font-size:13px}
  .bm .pick select{padding:5px 8px;border:1px solid var(--line);border-radius:6px;max-width:100%}
  .bm .ok{color:var(--green)}.bm .bad{color:var(--red);font-weight:600}
  .bm .onfile{border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin:6px 0;background:#fff;font-size:13px;white-space:pre-wrap}
  `;
  let cssDone = false;
  function ensureCss() { if (cssDone) return; cssDone = true; const s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); }

  const isNum = v => typeof v === "number" && isFinite(v);
  const nz = v => isNum(v) ? v : 0;
  const near = (a, b) => Math.abs(a - b) < 1;
  const u = v => "$" + (Math.round(v * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });   // unit rates, e.g. $62 or $8.50
  const PADDLE_AFTER = "2026-11-10";                                                                   // same cut-over as pricing.js

  /* "How it is built" for one booking: quantity x rate explanations. Each piece is included only if it reproduces
     Airtable's own figure to within $1. Returns {} pieces that are absent when the rates are not loaded. */
  function build(b, o, f) {
    const d = {}, P = o.P;
    if (!P || !P.isReady() || !o.inputs) return d;
    const R = P.R, i = o.inputs(b), acts = String(i.acts || ""), has = s => acts.indexOf(s) >= 0;
    const people = i.students + i.chaps, paid = people - nz(b.g("freeChap")), aboard = nz(b.g("aboard")) || people + i.staff, trips = i.trips > 0 ? i.trips : 1;
    const pf = paid * i.days * R.programFullDay, pa = paid * i.arrDays * R.programArrDep;
    if (near(pf + pa, f.progFees)) d.prog = [
      { k: "pf", lbl: "Full program days", v: pf, n: paid + " paid × " + i.days + " day" + (i.days === 1 ? "" : "s") + " × " + u(R.programFullDay) },
      { k: "pa", lbl: "Arrival / departure days", v: pa, n: paid + " paid × " + i.arrDays + " day" + (i.arrDays === 1 ? "" : "s") + " × " + u(R.programArrDep) }];
    if (near(paid * R.supplies, f.supplies)) d.supNote = paid + " paid × " + u(R.supplies);
    if (near(i.sessions * R.campusSession, f.campusFee)) d.campNote = i.sessions + " session" + (i.sessions === 1 ? "" : "s") + " × " + u(R.campusSession);
    if (paid >= 0) d.paid = paid + " paid spaces (" + people + " people, " + nz(b.g("freeChap")) + " free chaperone" + (nz(b.g("freeChap")) === 1 ? "" : "s") + ")";
    const veh = nz(b.g("pennVehicles"));
    if (veh > 0 && near(veh * R.entrance, f.penn)) d.pennNote = veh + " vehicle" + (veh === 1 ? "" : "s") + " × " + u(R.entrance);
    else if (i.buses > 0 && near(i.buses * R.busEntrance, f.penn)) d.pennNote = i.buses + " bus" + (i.buses === 1 ? "" : "es") + " × " + u(R.busEntrance);
    if (f.grat > 0 && near(aboard * trips * R.gratuity, f.grat)) d.gratNote = aboard + " aboard × " + trips + " trip" + (trips === 1 ? "" : "s") + " × " + u(R.gratuity);
    /* boats, gear and guided kayaking, from the Rates table */
    const boatAct = has("Boat Snorkel"), snork = boatAct || has("Shore Snorkel");
    const perBoat = R.boatCap ? Math.ceil(aboard / R.boatCap) : 0, dep = boatAct ? perBoat * trips : 0;
    const boats = dep * R.boatRate, gear = snork ? people * R.gear : 0;
    const boatRows = [];
    if (dep > 0) boatRows.push({ k: "boat", lbl: "Boat snorkel charters", v: boats, n: perBoat + " boat" + (perBoat === 1 ? "" : "s") + " × " + trips + " trip" + (trips === 1 ? "" : "s") + " = " + dep + " departures × " + u(R.boatRate) });
    if (gear > 0) boatRows.push({ k: "gear", lbl: "Snorkel gear", v: gear, n: people + " people × " + u(R.gear) });
    const kayakRows = (dbl, stf, tag) => { const doubles = Math.ceil(people / 2); return [
      { k: "kd", lbl: "Guided double kayaks" + tag, v: doubles * dbl, n: doubles + " doubles × " + u(dbl) },
      { k: "ks", lbl: "Staff kayaks" + tag, v: R.staffKayaks * stf, n: R.staffKayaks + " × " + u(stf) }]; };
    const pad = !!i.created && Date.parse(i.created) > Date.parse(PADDLE_AFTER);
    const autoKay = has("Kayaking") ? kayakRows(pad ? R.paddleDouble : R.kayakDouble, pad ? R.paddleStaff : R.kayakSingle, "") : [];
    const sum = rows => rows.reduce((s, r) => s + r.v, 0);
    if (f.manualEst > 0) { if (boatRows.length && near(sum(boatRows), f.manualEst)) d.est = boatRows; else d.estGap = sum(boatRows); }
    else if (f.vendorAuto > 0) { const all = boatRows.concat(autoKay); if (near(sum(all), f.vendorAuto)) d.auto = all; }
    if (f.addVendor > 0 && has("Kayaking")) {
      const alt = [kayakRows(R.paddleDouble, R.paddleStaff, " (Paddle the Florida Keys)"), kayakRows(R.kayakDouble, R.kayakSingle, " (REEF / Pennekamp rate)")].find(rs => near(sum(rs), f.addVendor));
      if (alt) d.add = alt;
    }
    /* staff and campus */
    const dHrsRule = i.days * 10 + i.arrDays * 5;
    if (!f.hoursOverride && f.dHrs > 0 && near(dHrsRule, f.dHrs)) d.dHrsNote = i.days + " full × 10 + " + i.arrDays + " arrival/departure × 5";
    if (f.team > 0 && f.dHrs > 0 && near(f.team * f.dHrs * 1.25, f.sHrs)) d.sHrsNote = f.team + " staff × " + f.dHrs + " hrs × 1.25 prep";
    if (f.sHrs > 0) d.staffRate = f.staffLabor / f.sHrs;
    if (f.cHrs > 0) d.campRate = f.campusCost / f.cHrs;
    return d;
  }

  /* Pull every figure for one booking. `g` reads a config key (see config.js F). */
  function figures(b, o) {
    const g = k => b.g(k);
    const total = nz(g("total")), tax = nz(g("tax"));
    const revenue = isNum(g("revenue")) ? g("revenue") : total - tax;          // Program Revenue (price less sales tax)
    const progFees = nz(g("progFees")), campusFee = nz(g("campusFee")), supplies = nz(g("supplies")), subtotal = nz(g("subtotal"));
    const manualEst = nz(g("manualVendorEst")), vendorAuto = nz(g("vendorAuto")), addVendor = nz(g("addVendor")), penn = nz(g("pennTotal")), grat = nz(g("gratTotal"));
    const passThrough = subtotal - progFees - campusFee - supplies;             // vendors, gratuities, Pennekamp billed inside the price
    const hard = [
      ["auto", "Boat, gear & kayak vendors (automatic)", vendorAuto, ""],
      ["est", "Vendor estimate (manual, used instead of automatic)", manualEst, ""],
      ["add", "Additional vendor costs (manual)", addVendor, ""],
      ["penn", "Pennekamp entrance & glass-bottom boat", penn, ""],
      ["grat", "Crew gratuities", grat, ""],
      ["mat", "Materials (actual cost)", nz(g("materialsActual")), ""],
      ["mile", "Mileage", nz(g("mileage")), ""]
    ];
    const hardSum = hard.reduce((s, r) => s + r[2], 0);
    const staffLabor = nz(g("staffLabor")), campusCost = nz(g("campusCost"));
    const totalCost = isNum(g("totalCost")) ? g("totalCost") : hardSum + staffLabor + campusCost;
    const margin = isNum(g("margin")) ? g("margin") : revenue - totalCost;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
    const students = nz(g("students")), chaps = nz(g("chaps"));
    const team = nz(g("teamTotal")), dHrs = nz(g("deliveryHrs")), sHrs = nz(g("staffHours")), cHrs = nz(g("campusHours"));
    const mealsRev = nz(g("mealsRev")), mealsCost = nz(g("mealsCost"));
    const ck = [];
    const directExp = g("directExp");
    if (isNum(directExp) && Math.abs(directExp - hardSum) >= 1) ck.push("Hard-cost lines add to " + o.money(hardSum) + " but Airtable's Direct Expenses is " + o.money(directExp));
    if (Math.abs(hardSum + staffLabor + campusCost - totalCost) >= 1) ck.push("Hard + staff + campus = " + o.money(hardSum + staffLabor + campusCost) + " but Airtable's Total Program Cost is " + o.money(totalCost));
    if (Math.abs(revenue - totalCost - margin) >= 1) ck.push("Revenue minus cost = " + o.money(revenue - totalCost) + " but Airtable's Program Margin $ is " + o.money(margin));
    if (team === 0 && revenue > 0) ck.push("No staffing entered, so staff cost is $0 and the margin is overstated");
    const f = { id: b.id, b, total, tax, revenue, progFees, campusFee, supplies, subtotal, passThrough, uplift: nz(g("uplift")), discount: nz(g("discountAmt")),
      manualEst, vendorAuto, addVendor, penn, grat, vendorsBilled: (manualEst > 0 ? manualEst : vendorAuto) + addVendor + grat,
      hard, hardSum, staffLabor, campusCost, totalCost, margin, marginPct, students, chaps, paid: students + chaps - nz(g("freeChap")),
      team, dHrs, sHrs, cHrs, hoursOverride: nz(g("hoursOverride")) > 0, mealsRev, mealsCost, mealsMargin: mealsRev - mealsCost, ck };
    f.d = build(b, o, f);
    return f;
  }

  function label(b, o) {
    const a = b.g("arrival"), d = b.g("departure");
    const days = a && d ? Math.round((Date.parse(String(d).slice(0, 10)) - Date.parse(String(a).slice(0, 10))) / 864e5) + 1 : null;
    const short = s => new Date(String(s).slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const yr = a ? String(a).slice(0, 4) : "";
    return { h1: days ? days + "-day" : "Option", h2: a ? short(a) + (d ? " to " + short(d) : "") + ", " + yr : "" };
  }

  const doneRe = /complet|cancel|lost|declin/i;
  function siblings(b, all, o) {
    const org = String(b.g("org") || "").trim().toLowerCase(), arr = Date.parse(String(b.g("arrival") || "").slice(0, 10));
    if (!org || isNaN(arr)) return [];
    return all.filter(x => x.id !== b.id && String(x.g("org") || "").trim().toLowerCase() === org
      && !String(x.g("name") || "").startsWith(o.testPrefix) && !doneRe.test(o.txt(x.g("status")) || "")
      && Math.abs(Date.parse(String(x.g("arrival") || "").slice(0, 10)) - arr) <= 21 * 864e5);
  }

  function html(o) {
    ensureCss();
    const b = o.cur;
    if (o.role !== "rose") return `<div class="card bm"><h3>Budget &amp; Margin</h3><div class="warn">This panel shows REEF's internal costs and margin. Switch the View menu (top right) to <b>Pricing &amp; costs view</b> to see it. This is a display setting, not security.</div></div>`;
    const cols = [b]; siblings(b, o.bookings, o).forEach(x => { if (cols.length < MAX_COLS) cols.push(x); });
    const picked = pickedId && o.bookings.find(x => x.id === pickedId);
    if (picked && !cols.includes(picked) && cols.length < MAX_COLS) cols.push(picked);
    const F = cols.map(x => figures(x, o)), L = cols.map(x => label(x, o)), money = o.money;
    const pct = v => v.toFixed(1) + "%";
    const sgn = v => (v < 0 ? "−" : "") + money(Math.abs(v));
    const hrs = v => (Math.round(v * 100) / 100) + " hrs";
    const two = F.length === 2;
    const sgnPct = v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + " pts";
    /* vals: numbers (null = "—"); notes: optional per-column explanation shown under each number */
    const row = (lbl, vals, fmt, cls, sub, notes) => `<tr class="${cls || ""}"><td>${o.esc(lbl)}${sub ? `<small>${o.esc(sub)}</small>` : ""}</td>${vals.map((v, i) => `<td>${v == null ? "—" : fmt(v)}${notes && notes[i] ? `<small>${o.esc(notes[i])}</small>` : ""}</td>`).join("")}${two ? `<td class="dlt">${vals[0] == null || vals[1] == null ? "" : fmt === pct ? sgnPct(vals[1] - vals[0]) : fmt === hrs ? "" : sgn(vals[1] - vals[0])}</td>` : ""}</tr>`;
    /* detail rows: each column supplies [{k,lbl,v,n}]; rows are aligned by key */
    const detail = (pick) => { const keys = [], labels = {}; F.forEach(f => (pick(f) || []).forEach(x => { if (!keys.includes(x.k)) { keys.push(x.k); labels[x.k] = x.lbl.replace(/ \(.*\)$/, ""); } }));
      return keys.map(k => { const per = F.map(f => (pick(f) || []).find(x => x.k === k)); const lbl = (per.find(Boolean) || {}).lbl || labels[k];
        return row(lbl, per.map(x => x ? x.v : null), money, "det", "", per.map(x => x ? x.n : "")); }).join(""); };
    const grp = t => `<tr class="grp"><td colspan="${F.length + 1 + (two ? 1 : 0)}">${t}</td></tr>`;
    const colHead = L.map((l, i) => `<th><span class="h1">${o.esc(l.h1)}</span>${o.esc(l.h2)}${i === 0 ? "<br><i>(open booking)</i>" : ""}</th>`).join("");
    const anyD = pick => F.some(f => f.d && pick(f.d));
    const notes = pick => F.map(f => (f.d && pick(f.d)) || "");

    let r = `<tr><th></th>${colHead}${two ? `<th><span class="h1">Difference</span>${o.esc(L[1].h1)} minus ${o.esc(L[0].h1)}</th>` : ""}</tr>`;
    /* ---- 1. what the school pays ---- */
    r += grp("What the school pays");
    r += row("REEF program fees", F.map(f => f.progFees), money, "", "", notes(d => d.paid));
    if (anyD(d => d.prog)) r += detail(f => f.d && f.d.prog);
    r += row("REEF supplies", F.map(f => f.supplies), money, "", "", notes(d => d.supNote));
    r += row("Campus facility fee", F.map(f => f.campusFee), money, "", "", notes(d => d.campNote));
    r += row("Pennekamp entrance & boat", F.map(f => f.penn), money, "", "", notes(d => d.pennNote));
    r += row("Vendors, incl. crew gratuities and additional vendor costs", F.map(f => f.vendorsBilled), money, "", "Itemized under Hard costs below");
    r += row("Subtotal", F.map(f => f.subtotal), money, "sub");
    r += row("Uplift", F.map(f => f.uplift), money);
    if (F.some(f => f.discount)) r += row("Discount", F.map(f => -f.discount), sgn);
    if (F.some(f => f.tax)) r += row("Sales tax", F.map(f => f.tax), money);
    r += row("Total package price", F.map(f => f.total), money, "sub", "", F.map(f => f.students > 0 ? money(f.total / f.students) + " per student" : ""));
    r += row("Revenue to REEF (price less sales tax)", F.map(f => f.revenue), money, "sub");
    /* ---- 2. hard costs ---- */
    r += grp("Hard costs (REEF pays vendors), line by line");
    const H = k => F.map(f => f.hard.find(h => h[0] === k)[2]);
    const hardRow = (k, lbl, pickRows, noteFn) => { if (!F.some(f => f.hard.find(h => h[0] === k)[2] !== 0)) return "";
      return row(lbl, H(k), money, "", "", noteFn ? notes(noteFn) : null) + (pickRows && anyD(d => pickRows(d)) ? detail(f => f.d && pickRows(f.d)) : ""); };
    r += hardRow("auto", "Boat, gear & kayak vendors (automatic from Rates table)", d => d.auto);
    r += hardRow("est", "Vendor estimate (manual, used instead of automatic)", d => d.est);
    r += hardRow("add", "Additional vendor costs (entered manually)", d => d.add);
    r += hardRow("penn", "Pennekamp entrance & glass-bottom boat", null, d => d.pennNote);
    r += hardRow("grat", "Crew gratuities", null, d => d.gratNote);
    r += hardRow("mat", "Materials (actual cost)");
    r += hardRow("mile", "Mileage");
    r += row("Total hard costs", F.map(f => f.hardSum), money, "sub");
    /* ---- 3. staff and campus ---- */
    r += grp("Staff and campus (internal)");
    r += row("Staff on program", F.map(f => f.team), v => String(v), "", "REEF staff counted for labor");
    r += row("Delivery hours per person", F.map(f => f.dHrs), hrs, "", F.some(f => f.hoursOverride) ? "Includes a manual hours override" : "", notes(d => d.dHrsNote));
    r += row("Staff labor hours", F.map(f => f.sHrs), hrs, "", "", notes(d => d.sHrsNote));
    r += row("Staff labor cost", F.map(f => f.staffLabor), money, "", "", F.map(f => f.d && f.d.staffRate ? f.sHrs + " hrs × " + u(f.d.staffRate) : ""));
    r += row("Campus facility cost (internal)", F.map(f => f.campusCost), money, "", "", F.map(f => f.d && f.d.campRate ? f.cHrs + " campus hrs × " + u(f.d.campRate) : ""));
    r += row("Total program cost", F.map(f => f.totalCost), money, "sub", "Hard costs + staff + campus");
    /* ---- 4. result ---- */
    r += grp("Result");
    r += row("Net margin $", F.map(f => f.margin), sgn, "net");
    r += row("Net margin % of revenue", F.map(f => f.marginPct), pct, "net");
    r += row("Margin per student", F.map(f => f.students > 0 ? f.margin / f.students : 0), v => money(v));
    if (F.some(f => f.mealsRev || f.mealsCost)) {
      r += grp("Optional meals (billed separately, not in the price above)");
      r += row("Meals revenue", F.map(f => f.mealsRev), money);
      r += row("Meals vendor cost", F.map(f => f.mealsCost), money);
      r += row("Combined margin incl. meals", F.map(f => f.margin + f.mealsMargin), sgn, "sub");
    }

    const kp = F.map((f, i) => `<div class="kpi2"><div class="n">${pct(f.marginPct)}</div><div class="l">${o.esc(L[i].h1)} margin &middot; ${sgn(f.margin)} on ${money(f.revenue)}</div></div>`).join("");
    const checks = F.map((f, i) => f.ck.map(c => `<div class="warn">${o.esc(L[i].h1 + " (" + L[i].h2 + "): " + c)}</div>`).join("")).join("");
    const gaps = F.map((f, i) => f.d && f.d.estGap != null ? `<div class="warn">${o.esc(L[i].h1)}: the manual vendor estimate (${money(f.manualEst)}) differs from what the Rates table gives for this group (${money(f.d.estGap)}), so it is shown as one line. Airtable's figure is used.</div>` : "").join("");
    const clean = F.every(f => !f.ck.length);
    const filed = F.map((f, i) => { const t = String(f.b.g("internalNotes") || "").split("\n").filter(s => /^(PRICING|STAFFING)/i.test(s.trim())).join("\n");
      return t ? `<div class="onfile"><b>${o.esc(L[i].h1)} · notes on file (Internal notes in Airtable)</b>\n${o.esc(t)}</div>` : ""; }).join("");
    const others = o.bookings.filter(x => x.id !== b.id && !String(x.g("name") || "").startsWith(o.testPrefix) && !doneRe.test(o.txt(x.g("status")) || ""))
      .sort((p, q) => String(p.g("arrival") || "").localeCompare(String(q.g("arrival") || "")));
    const opts = `<option value="">Sibling options only (same school, within 3 weeks)</option>` + others.map(x => `<option value="${x.id}" ${x.id === pickedId ? "selected" : ""}>${o.esc(x.g("name") || x.id)}</option>`).join("");
    window.REEF_BM = { pick: id => { pickedId = id || null; o.rerender(); } };

    return `<div class="card bm"><h3>Budget &amp; Margin <span class="chip c-proto">INTERNAL · READ-ONLY</span></h3>
      <p class="note">Internal only. Totals are Airtable's own results. The grey lines show how each total is built (quantity × rate from the Rates table) and appear only when they add up to Airtable's number. The school sees none of this, and it must never appear in the public proposal pages.</p>
      <div class="pick"><label>Compare with <select onchange="REEF_BM.pick(this.value)">${opts}</select></label></div>
      <div class="kpis">${kp}</div>${checks}${gaps}
      <div class="bm-wrap mt"><table class="bmt">${r}</table></div>
      <p class="note mt">${clean ? '<span class="ok">Checks pass:</span> hard-cost lines, staff, and campus add up to Airtable\'s Total Program Cost, and revenue minus cost equals Airtable\'s Program Margin.' : '<span class="bad">Check the warnings above before relying on these numbers.</span>'}</p>
      ${filed}</div>`;
  }

  return { html, figures };
})();
