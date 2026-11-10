/* REEF Booking Program Manager: Budget & Margin panel (INTERNAL, read-only).
   Shows, for the open booking and its sibling options side by side: what the school pays, hard costs line by line,
   staff and campus cost, and net dollars and percent. It only DISPLAYS Airtable's own formula results (Program Revenue,
   Total Program Cost, Program Margin $/%). It never recalculates prices, never writes, and never touches reef-program-pages.
   The "Pricing & costs view" gate hides it from the Staff view as a courtesy; it is NOT access control (a token can read
   every field in the base).
   Hook: app.js calls ReefBudgetMargin.html({...}) from a tab function. No other file needs to change except config.js (field keys). */
window.ReefBudgetMargin = (function () {
  let pickedId = null;                       // booking the user chose in "Compare with"
  const MAX_COLS = 4;

  const CSS = `
  .bm .bm-wrap{overflow-x:auto}
  .bm table.bmt{width:100%;border-collapse:collapse;min-width:520px}
  .bm table.bmt th{font-size:12px;text-align:right;color:var(--mute);font-weight:600;padding:6px 10px;border-bottom:2px solid var(--line);vertical-align:bottom}
  .bm table.bmt th:first-child{text-align:left}
  .bm table.bmt th .h1{display:block;color:var(--navy);font-size:13px}
  .bm table.bmt td{padding:6px 10px;border-bottom:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums}
  .bm table.bmt td:first-child{text-align:left}
  .bm table.bmt td.lbl small{display:block;color:var(--mute);font-size:11.5px}
  .bm table.bmt tr.grp td{background:var(--sand);font-weight:700;color:var(--navy);text-align:left;font-size:12px;letter-spacing:.4px;text-transform:uppercase;border-bottom:1px solid var(--line)}
  .bm table.bmt tr.sub td{font-weight:600;background:#fafcfd}
  .bm table.bmt tr.net td{font-weight:700;font-size:15px;background:var(--teal-l);border-top:2px solid var(--teal)}
  .bm td.neg{color:var(--red)}.bm td.pos{color:var(--green)}
  .bm td.dlt{background:#fafcfd;color:var(--mute)}
  .bm .kpis{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin:10px 0 4px}
  .bm .kpi2{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:#fff}
  .bm .kpi2 .n{font-size:20px;font-weight:700;color:var(--navy)}.bm .kpi2 .l{font-size:12px;color:var(--mute)}
  .bm .pick{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0 12px;font-size:13px}
  .bm .pick select{padding:5px 8px;border:1px solid var(--line);border-radius:6px;max-width:100%}
  .bm .ok{color:var(--green)}.bm .bad{color:var(--red);font-weight:600}
  `;
  let cssDone = false;
  function ensureCss() { if (cssDone) return; cssDone = true; const s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); }

  const isNum = v => typeof v === "number" && isFinite(v);
  const nz = v => isNum(v) ? v : 0;

  /* Pull every figure for one booking. `g` reads a config key (see config.js F). */
  function figures(b, o) {
    const g = k => b.g(k);
    const total = nz(g("total")), tax = nz(g("tax"));
    const revenue = isNum(g("revenue")) ? g("revenue") : total - tax;          // Program Revenue (price less sales tax)
    const progFees = nz(g("progFees")), campusFee = nz(g("campusFee")), supplies = nz(g("supplies")), subtotal = nz(g("subtotal"));
    const passThrough = subtotal - progFees - campusFee - supplies;             // vendors, gratuities, Pennekamp billed inside the price
    const hard = [
      ["Boat, gear & kayak vendors (auto)", nz(g("vendorAuto")), "Ocean First / Paddle / other, from the Rates table"],
      ["Vendor estimate (manual override)", nz(g("manualVendorEst")), "Replaces the auto vendor line when filled in"],
      ["Additional vendor costs (manual)", nz(g("addVendor")), ""],
      ["Pennekamp entrance & glass-bottom boat", nz(g("pennTotal")), ""],
      ["Crew gratuities", nz(g("gratTotal")), ""],
      ["Materials (actual cost)", nz(g("materialsActual")), ""],
      ["Mileage", nz(g("mileage")), ""]
    ];
    const hardSum = hard.reduce((s, r) => s + r[1], 0);
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
    return { id: b.id, b, total, tax, revenue, progFees, campusFee, supplies, subtotal, passThrough, uplift: nz(g("uplift")), discount: nz(g("discountAmt")),
      hard, hardSum, staffLabor, campusCost, totalCost, margin, marginPct, students, chaps, paid: students + chaps - nz(g("freeChap")),
      team, dHrs, sHrs, cHrs, hoursOverride: nz(g("hoursOverride")) > 0, mealsRev, mealsCost, mealsMargin: mealsRev - mealsCost, ck };
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
    const two = F.length === 2;
    const cell = (v, f, cls) => `<td class="${cls || ""}">${f(v)}</td>`;
    const row = (lbl, vals, f, cls, sub) => `<tr class="${cls || ""}"><td class="lbl">${o.esc(lbl)}${sub ? `<small>${o.esc(sub)}</small>` : ""}</td>${vals.map(v => `<td>${f(v)}</td>`).join("")}${two ? `<td class="dlt">${f === pct ? sgnPct(vals[1] - vals[0]) : sgn(vals[1] - vals[0])}</td>` : ""}</tr>`;
    const sgnPct = v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + " pts";
    const grp = t => `<tr class="grp"><td colspan="${F.length + 1 + (two ? 1 : 0)}">${t}</td></tr>`;
    const colSpanHead = L.map((l, i) => `<th><span class="h1">${o.esc(l.h1)}</span>${o.esc(l.h2)}${i === 0 ? "<br><i>(open booking)</i>" : ""}</th>`).join("");

    let r = `<tr><th></th>${colSpanHead}${two ? `<th><span class="h1">Difference</span>${o.esc(L[1].h1)} minus ${o.esc(L[0].h1)}</th>` : ""}</tr>`;
    r += grp("What the school pays");
    r += row("REEF program fees", F.map(f => f.progFees), money);
    r += row("Campus facility fee", F.map(f => f.campusFee), money);
    r += row("Supplies & materials fee", F.map(f => f.supplies), money);
    r += row("Vendors, gratuities & Pennekamp billed in price", F.map(f => f.passThrough), money, "", "Passed through at cost");
    r += row("Uplift", F.map(f => f.uplift), money);
    if (F.some(f => f.discount)) r += row("Discount", F.map(f => -f.discount), sgn);
    r += row("Revenue to REEF (price less sales tax)", F.map(f => f.revenue), money, "sub");
    r += grp("Hard costs (REEF pays vendors)");
    F[0].hard.forEach((h, i) => { if (F.some(f => f.hard[i][1] !== 0)) r += row(h[0], F.map(f => f.hard[i][1]), money, "", h[2]); });
    r += row("Total hard costs", F.map(f => f.hardSum), money, "sub");
    r += grp("Staff and campus (internal)");
    r += row("Staff labor", F.map(f => f.staffLabor), money, "", F.map(f => f.team + " people, " + f.sHrs + " hrs" + (f.hoursOverride ? " (hours overridden)" : "")).filter((v, i, a) => a.indexOf(v) === i).join(" / "));
    r += row("Campus facility (internal)", F.map(f => f.campusCost), money, "", F.map(f => f.cHrs + " campus hrs").filter((v, i, a) => a.indexOf(v) === i).join(" / "));
    r += row("Total program cost", F.map(f => f.totalCost), money, "sub");
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
    const clean = F.every(f => !f.ck.length);
    const others = o.bookings.filter(x => x.id !== b.id && !String(x.g("name") || "").startsWith(o.testPrefix) && !doneRe.test(o.txt(x.g("status")) || ""))
      .sort((p, q) => String(p.g("arrival") || "").localeCompare(String(q.g("arrival") || "")));
    const opts = `<option value="">Sibling options only (same school, within 3 weeks)</option>` + others.map(x => `<option value="${x.id}" ${x.id === pickedId ? "selected" : ""}>${o.esc(x.g("name") || x.id)}</option>`).join("");
    window.REEF_BM = { pick: id => { pickedId = id || null; o.rerender(); } };

    return `<div class="card bm"><h3>Budget &amp; Margin <span class="chip c-proto">INTERNAL · READ-ONLY</span></h3>
      <p class="note">Internal only. Figures are Airtable's own results, not recalculated here. The school sees none of this, and it must never appear in the public proposal pages.</p>
      <div class="pick"><label>Compare with <select onchange="REEF_BM.pick(this.value)">${opts}</select></label></div>
      <div class="kpis">${kp}</div>${checks}
      <div class="bm-wrap mt"><table class="bmt">${r}</table></div>
      <p class="note mt">${clean ? '<span class="ok">Checks pass:</span> hard-cost lines, staff, and campus add up to Airtable\'s Total Program Cost, and revenue minus cost equals Airtable\'s Program Margin.' : '<span class="bad">Check the warnings above before relying on these numbers.</span>'}
      Staff labor uses delivery hours × 1.25 prep time × $35/hr; the hours rule lives in the Airtable formula.</p></div>`;
  }

  return { html, figures };
})();
