/* DATA ADAPTER: the only file that knows how data is fetched or what the auth model is.
   To move to a different host or auth approach later (a proxy, SSO, a server), replace this file
   with one that exposes the same ReefData interface. The UI never calls fetch() directly.

   Auth model today (same as the REEF Scheduling Dashboard): each person pastes their own Airtable
   personal access token. It is held in memory (optionally sessionStorage for this tab only), sent only
   to api.airtable.com, and never written to the repo, the URL, or a cookie. */
(function () {
  const C = window.REEF_CONFIG, API = "https://api.airtable.com/v0";
  let token = null, who = null, scopes = [];

  /* Field IDs of the other tables (structure only). */
  const FX = {
    schedule: {booking:"fld3IFyuSMhEhIk3j", day:"fldD5F2jqNh98G059", type:"fldRX68Do7nXfibOc", cohort:"fldyF4IOUHnjLBOhe", start:"fldnfyxTrkh3BIFIy", end:"fldLvLdotNAPjOAmR", name:"fldA1uxhbnsdlnM53", loc:"fld6Lf6mYXQOoYcTA", rowCheck:"fldBdQbcgMPNih7dn", edited:"fldwLWn6uLuymV3nV", startHM:"fld6ZXXwtnyVQXiJz", endHM:"flduffPfhDSfUpoRs", internal:"fldJozYW1ZsjgtvAX"},
    comms: {summary:"fldyfBpgjI99tPxqR", booking:"fld0yV06EMb364wDo", date:"fldqOd7K3DlVNYYAG", dir:"fldF4BVaEHaLEVtbN", what:"fldQPFJ8Rs7hawYJ0", ver:"fld8RCqSwumgulhG2", details:"fldvZu3MtSzK8Unnd", by:"fldyxKTYlLDF6aUlt"},
    checklist: {item:"fld0QmKxGP1qn0S1C", booking:"fldl9U7R5wd51QTCQ", key:"fldvPaPRRFhDtFRCW", done:"fldyIZDGmyfULPD8x", doneOn:"flddmf1qgpHfyB48Z", doneBy:"fldZFvEtmrZ5cZghT"},
    changes: {summary:"fldcKsw5wflvIviwG", booking:"fldc6Y2ynY1EUzU4k", type:"fldAZk9ophyqR0ISR", students:"fldYuSWmfc8nRAx5V", chaps:"fldYr6vAT3spurGsr", arr:"fldbqBpoZnHiZquMy", dep:"fldlTCCWt37obIORj", details:"fldQb8Cs3ZwW2Zzh3", reason:"fldyKti77rTuk2QBn", status:"fld0ueqm80o9Bv1ia", notes:"fldx5f9G5wdpZQG8H", applied:"fldncFVH2uINkY0WL", submitted:"fldBGBhIaL2nODlJg"},
    vendors: {name:"fldJXlYdLLboDvdDU", cat:"fldaWx0fSdL6deDWg", status:"fldoONPWl4JtotDzS", contact:"fldHVWeeKftCAfFMh", phone:"fldJVmTUvlkzPbPob", email:"fldAWfCCJfzt4plsO", web:"fldsAgdnwAfoPYGeA", leadDays:"fldeCaHdOva3g9pac", notes:"fldnGGn4WhxlKvFwh", rates:"fldUdAUH5A6EJnu4O", review:"fldkhtn0JHNdONoQs", confirmedOn:"fld2DOIVJo7OH2sAs", confirmed:"fldhbQRFsKkElrzMc", actions:"fld80PJPPYuLIuE4k"},
    rates: {key:"fldRYBqehbV1cckD9", name:"fldadLk6n35nhrTv3", cat:"fldzbw4Aurpts8776", vendor:"fldNcPkwaDQiOkJ1n", vendorName:"fldjDksddglOGCstH", cur:"fldoteimNwlYE0l6g", num:"fldgwo9ZQv09nEFhr", text:"fldgUzBiszA77SWGr", unit:"fldzag1pINQmNbX9S", eff:"fld6VhsDbajSsIlAv", active:"fldfbnyHWr1Lu2YEI", notes:"fldZ4XX8ZTKiMuRq2", status:"fldcZViXxZuaWm791", avail:"fldcOWfy9rUIpSQy9", confirmedOn:"fld5afjY8nc4arXDm", reviewDue:"fldOtWHLr9RNtlKbg"},
    itin: {label:"fldJq0vMyOnAQsp2Y", booking:"fldOPFdBGlO0RvXCG", name:"fldgYk2RvZ6eMZdUF", desc:"fldbCkHmE1mN0G0dK", loc:"fldAiAJJeBnvcvdtV", check:"fldkllfXJ3ZQ4vCZQ"},
    vlines: {name:"fldi4cb2KFvPnjf9B", booking:"fld0WOZ2MMpG7t5NZ", vendor:"fldRseKtnt6jz0FKn", type:"fldELZFsX0yCRDfJX", status:"fld7YpSdZzINo0g7g", vessels:"fldMC1SN8Yl8TcYUl", cap:"fldSyzdvjThOaRdf7", quote:"fldysAAXSC3ozTN6F", perPerson:"fldsoPo2OAMK81Fcb", date:"fldakh7UvCvDxbisK", notes:"flddl6TYjkDr9SeFk"},
    versions: {label:"fldTiFQ19SLP9Wp9E", booking:"fld9shgPkcovzaeqY", version:"fldo9lLqOFJTBtgUt", total:"fldoYWMVJkbBK1dFd", students:"fldxWZsJpLZHTyMCI", chaps:"fldB3hUbdHYYljQEe", arrival:"fldUBjgPZLoTjDglV", commit:"fldlzzrdRqK77y105", path:"fldDjbNflYjOuvlOp", at:"fldkBodBHe3GJHsf5"},
    activities: {name:"fldkS3bfc5eMBvXW6", cap:"fld41xUflvXl26F4W", capUnit:"fldrZZwJqwVzOCVko", hours:"fld7qoLnTVqNpBMYF", boat:"fldn8AvFcNnsnhmvM", vendor:"fldilW7iChIgzL8ZO", active:"fldJfT2otiFRU8r0W", notes:"fldtAqa4z7eJIhqOR"}
  };

  async function call(method, path, body, attempt) {
    attempt = attempt || 0;
    if (!token) throw new Error("No token");
    const res = await fetch(API + path, {
      method, headers: Object.assign({ Authorization: "Bearer " + token }, body ? { "Content-Type": "application/json" } : {}),
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 429 && attempt < 4) { await new Promise(r => setTimeout(r, 1200 * (attempt + 1))); return call(method, path, body, attempt + 1); }
    if (!res.ok) {
      let msg = ""; try { msg = (await res.json()).error; msg = typeof msg === "object" ? (msg.type + ": " + msg.message) : msg; } catch (e) {}
      const err = new Error("Airtable " + res.status + (msg ? " (" + msg + ")" : "")); err.status = res.status; throw err;
    }
    return res.json();
  }

  async function listAll(tableId, fieldIds, onPage) {
    let offset, out = [];
    do {
      const body = { pageSize: 100, returnFieldsByFieldId: true };
      if (fieldIds) body.fields = fieldIds;
      if (offset) body.offset = offset;
      const r = await call("POST", "/" + C.BASE_ID + "/" + tableId + "/listRecords", body);
      out = out.concat(r.records); offset = r.offset; if (onPage) onPage(out.length);
    } while (offset);
    return out;
  }

  /* Vendor picker data: Rates, Vendors and Activities, read-only, only the fields the picker uses. Cached for the session. */
  const VFIELDS = {
    rates: ["key", "name", "cat", "vendor", "vendorName", "cur", "num", "unit", "eff", "active", "notes", "status", "avail", "activities"],
    vendors: ["name", "cat"], activities: ["name", "vendor"]
  };
  FX.rates.activities = "fldw9PSxujfzQ7uwi";
  let vcache = null;
  async function loadVendorData(force) {
    if (vcache && !force) return vcache;
    const ids = (t, ks) => ks.map(k => FX[t][k]);
    vcache = {
      rates: await listAll(C.T.rates, ids("rates", VFIELDS.rates)),
      vendors: await listAll(C.T.vendors, ids("vendors", VFIELDS.vendors)),
      activities: await listAll(C.T.activities, ids("activities", VFIELDS.activities)), loadedAt: new Date().toISOString()
    };
    return vcache;
  }

  const ReefData = {
    FX, loadVendorData,
    hasToken: () => !!token,
    setToken(t, remember) {
      token = (t || "").trim(); who = null; scopes = [];
      try { if (remember) sessionStorage.setItem("reef_pat", token); else sessionStorage.removeItem("reef_pat"); } catch (e) {}
    },
    restore() { try { const t = sessionStorage.getItem("reef_pat"); if (t) { token = t; return true; } } catch (e) {} return false; },
    clear() { token = null; who = null; scopes = []; vcache = null; try { sessionStorage.removeItem("reef_pat"); } catch (e) {} },

    /* Connection check: who am I, what can this token do, can it read the Bookings table. */
    async verify() {
      who = await call("GET", "/meta/whoami");
      scopes = who.scopes || [];
      await call("POST", "/" + C.BASE_ID + "/" + C.T.bookings + "/listRecords", { pageSize: 1, fields: [C.F.name], returnFieldsByFieldId: true });
      return this.capabilities();
    },
    capabilities() {
      return { user: who && (who.email || who.id) || "unknown", scopes,
        canRead: scopes.length === 0 ? null : scopes.includes("data.records:read"),
        canWrite: scopes.length === 0 ? null : scopes.includes("data.records:write"),
        canSchema: scopes.includes("schema.bases:read") };
    },

    /* Load everything the workspace needs. Read-only. */
    async loadAll(progress) {
      const step = (n) => (c) => progress && progress(n, c);
      const bookings = await listAll(C.T.bookings, Object.values(C.F), step("Bookings"));
      const rest = {};
      for (const k of ["schedule", "comms", "checklist", "changes", "vendors", "rates", "itin", "activities"]) {
        rest[k] = await listAll(C.T[k], null, step(k));
      }
      // Optional tables: absent or unreadable must never break the app.
      rest.optionalMissing = [];
      for (const k of ["versions", "vlines"]) {
        if (!C.T[k]) { rest[k] = []; rest.optionalMissing.push(k); continue; }
        try { rest[k] = await listAll(C.T[k], null, step(k)); } catch (e) { rest[k] = []; rest.optionalMissing.push(k); }
      }
      // Picker data: restricted fields, refreshed on every load (Rates change when vendors send sheets). A failure must never break the app.
      try { rest.vdata = await loadVendorData(true); } catch (e) { rest.vdata = null; rest.vdataError = e.message; }
      return Object.assign({ bookings, loadedAt: new Date().toISOString() }, rest);
    },

    /* Single-record refresh (used by the edit planner to detect that someone else changed it). */
    async getBooking(id) { const r = await call("POST", "/" + C.BASE_ID + "/" + C.T.bookings + "/listRecords", { filterByFormula: "RECORD_ID()='" + id + "'", returnFieldsByFieldId: true, fields: Object.values(C.F), pageSize: 1 }); return r.records[0]; },

    /* WRITE PATH. Only ReefEdits.commit calls these. Blocked by WRITES_ENABLED and, as defense in depth, unless the app is in Live mode. */
    async _patch(tableId, recordId, fields) {
      if (!C.WRITES_ENABLED) throw new Error("Writes are disabled in this build (dry-run only).");
      if (!(window.ReefMode && window.ReefMode.isLive())) throw new Error("Not in Live mode: nothing is saved from Sandbox.");
      return call("PATCH", "/" + C.BASE_ID + "/" + tableId + "/" + recordId, { fields, typecast: false });
    },
    async _create(tableId, fields) {
      if (!C.WRITES_ENABLED) throw new Error("Writes are disabled in this build (dry-run only).");
      if (!(window.ReefMode && window.ReefMode.isLive())) throw new Error("Not in Live mode: nothing is saved from Sandbox.");
      return call("POST", "/" + C.BASE_ID + "/" + tableId, { records: [{ fields }], typecast: false });
    }
  };
  window.ReefData = ReefData;
})();
