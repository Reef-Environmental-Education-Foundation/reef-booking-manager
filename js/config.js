/* REEF Booking Program Manager: configuration.
   Contains Airtable IDs only (structure, not data). No tokens, no booking data.
   Airtable base/table/field IDs are identifiers, not secrets: they are useless without a token. */
window.REEF_CONFIG = {
  VERSION: "0.3.0-readonly",
  BASE_ID: "app3FIECuG8iQr7kY",
  T: {
    bookings: "tbl9Jb9UVSYLQ1Puc", vendors: "tblu7zzoyc0UdHwz4", rates: "tbltdE9P1BnOoPlbL",
    schedule: "tbljjmfCplSFbUfGe", comms: "tbla8wjwBvfbjuaFw", checklist: "tbl6BmRXNhnxxfabD",
    changes: "tblPHwDDAvjER2uGe", itin: "tblL0oUvD4CG24E4j", activities: "tblb3FriVJzQcCBXu",
    versions: "tbluKC2sTvtaypK7W",   // Proposal Versions (created 11/3, written by the publish workflow once Option C is built)
    vlines: "tblkcaDalE4TtQ3FE"                     // Booking Vendor Lines: set to the table ID once Martha approves creating it
  },
  /* ---- WRITE SAFETY SWITCHES (all off). Do not change without Martha's written go-ahead. ---- */
  WRITES_ENABLED: false,          // master switch. false = dry-run only, no network write ever leaves the page
  WRITES_TEST_RECORDS_ONLY: true, // even when enabled, only records whose Booking Name starts with "ZZZ"
  TEST_PREFIX: "ZZZ",

  /* Bookings fields (by field ID, so renames in Airtable do not break the app). */
  F: {
    name: "fldBmn9f01AL6wFHQ", type: "fldn0y8ma8g2dz6bf", status: "fldPfG20fUuqrO5vc", source: "fldcu224m5IHsmtIZ",
    org: "fldRu9mD4gXmEeJIU", contact: "fldu67g0pRlmYzKal", email: "fldVIgkLxCVoJeenq", phone: "fldKHLSpfSTP5ZbZY", role: "fldhd4JlujjfQ0n6i",
    arrival: "fldoWKsdkwvpyepoh", departure: "fldt5jFpwKyVORxR9", location: "fldf1RWDyCyqcza1f", grade: "fldzwWsrl4ooODMST",
    students: "fldrUwjOXmZNfGilN", chaps: "fldyKhbJ6a2QHsTh1", fullDays: "fldaDXcCiZm3f1pf8", arrDepDays: "fldUMQjcVDFvQREDJ",
    sessions: "fld5VvDiOoiAstOuT", boatTrips: "fldYvd6szALcdUxdQ", buses: "fldHiayVwmt1nAMkB",
    discount: "fldz4KzNvsn1yq6ue", upliftOverride: "fldwJdA4jTAz5B2tg", freeChapOverride: "fldY7t32xjej07WXW", taxExempt: "fldbjcoAMudkUD8EZ",
    addVendor: "fldeniyXqIXMlT7PB", materialsFee: "fldGwLa515TL7nGzG",
    internalNotes: "fld1nLiTu1Pm9WhL4", customerNotes: "fldeYPh5QiHyWNsqj", special: "fldGKOut52TrAnZ1i",
    nextAction: "fldwJwTq1A3ElKpWp", followUp: "fldKJAWjDpdyd7FdJ", risk: "fldslxrq48Bo0OCar", roseNeeds: "fld3VH8AFXgU3jLGW",
    proposalSent: "fldCAKSPDYviZqOcd", response: "fldjD4wwfoL1o5oQP", agreementStatus: "fldy8rh3at1MZJ3zp", paymentStatus: "fldnP6wHnmPRhuIbm",
    approved: "flda7nOTutzFC2jhX", approvedStage: "fldSSoW4EFSy2vMZ5", propVer: "fldfkQePKaeJNBNwN", approvedVer: "fld8cyHmix2B4QpMV",
    publishedVer: "fldMDPd0TI6qANixf", publishResult: "fldChCOz6OfKyiag7", publishMsg: "fldQ4aJnkvowzIUXh", publishedAt: "fldRUTE32fRD2eHaH",
    acceptedVer: "fldtGarqGtsxAi0pY", acceptance: "fldnSg97Kvr1w0QEt", schedChanged: "fldi8oF6jigne8mvi",
    readiness: "fldF0AhPF2Z3U9ne0", check: "fldwOmvB1slmGYnKx", modified: "fldwooDWg4EiFgA3I",
    epoId: "fldZH2tuAO85hv2eU", asanaId: "fldHfDTeuy4LHvTrT",
    // price lines (customer-facing)
    progFees: "fldi1aqXISuwqHxut", campusFee: "fldiBD7ZgK1EjUcKy", supplies: "fldbsULEFAXaeZPGN", subtotal: "fld4e4y9GbpsJwjnX",
    uplift: "flduKwWTkcpOzSC6b", discountAmt: "fld3Xhk3MoR8nMget", tax: "fldcoouD1zMQcr66o", total: "fldnuoaZqg9uSnWOd", perPaid: "fldJoWJwTgCwAgyWs",
    vendorAuto: "fld1NehIhFWZc1Ufw", pennTotal: "fldDExjAVD7sQ3DzH", gratTotal: "fldA5gzNm3Rsh33Jo", pricingModel: "fldElB66WNS33nn9t",
    freeChap: "fldWpVEwDKeGkUrcu", billTravelers: "fldH6wc6g8FjSAyhM", reach: "fldewJJhOnqPykADX", teamTotal: "fldwt9q3sL9bAAHla", aboard: "fldcngDArA2pgUjRy",
    // internal (cost / margin)
    netIncome: "fldmphOpOVTHeFPQg", totalCost: "fld4vLRzFATowbHrj", margin: "flddLDxroBRy7u8QT", marginPct: "fld94akrbIWxHO7BG", marginSummary: "flde1ZvY9q1ObSj32",
    staffLabor: "fldG6X9RuncoEOxLJ", campusCost: "fldRE70HVMHNN0qrv", directExp: "fldpVbeYJH0uKQyJz", mileage: "fldL0gmXlWKc5VjHs", materialsActual: "fldWRPejeeIBbmtlK",
    manualVendorEst: "fldhDQFHEsjfF4nV1",
    // history / comparison
    histTotal: "flds3eGxiIvwHHwUr", priorSigned: "fldNUJoxvEriosLIe", priorSource: "flddsUiIOSxO3AQkt", prevQuoted: "fldZxhnQtXGJ9FvWt", chgPct: "fldgDQqFpLhW0fear", chgAmt: "fldrazfP3IKw6mFVR",
    // contract
    agreementDate: "fldnuf6ra0xBPdm3E", tier: "fldF9IdukYDM1L9wX", payTier: "fldnoIuLdBo4mkGBn", depositNow: "fldYsdIwIWseizwBE", depositOverride: "fldwBvQiTsRok7F8U",
    depositAmt: "fldBAJ2xLhAaCI5W8", depositDue: "fldk2vug26H75mMeX", pay2Amt: "fldmEsOZHCxTCxCfK", pay2Due: "fldi9v9lFKPTE7VhI",
    minGuarSpaces: "fldUAhz9djYgfBhyI", guarCost: "fldQf9IGWARao85TR", lockDate: "fldKYs0MYV6B6XLhg", rosterDue: "fldnNa5W5RhM7dQWY",
    freeSpaces: "fldfpdtyAw140LkeC", paidSpaces: "fldrvSziFjIzZ5FeM", lockedTotal: "fldAXRcqfJa4jX7Yo",
    finalAmt: "fld0GHfTy1hkcYb3G", finalDue: "fldHI66kx2oqchum4",
    // links
    scheduleLinks: "fldU7Wh5iEubsYwxI", itinLinks: "fldAmdGgbJThGCufS", commsLinks: "fldu4exjBCBHPiPlk", checklistLinks: "fld4sbsDUaysZquHi", changeLinks: "fldTKpwFsYBDlqLVA",
    activities: "fldLJq96jdno7p9sS", programType: "fldnMmE0udfDe8ke2", cohorts: "fldxhHNKnDAIN4ubk", rotation: "fldOr4EoGbIrunomi",
    schedNotes: "fldLM08w3h7sokUZF", walkthrough: "fldDUh5DMgXDOVaoN", daysToArrival: "fldVkGBpwOofwLobv"
  },
  /* Fields that show REEF's internal cost or margin. A scoped token can still read these.
     Hiding them in the page is a courtesy for the "Staff view", NOT security.  */
  INTERNAL_KEYS: ["netIncome","totalCost","margin","marginPct","marginSummary","staffLabor","campusCost","directExp","mileage","materialsActual","manualVendorEst"],

  /* Inputs the Airtable guardrail automation watches (wflxS2mTwBFYpj5kC). Editing any while Approved to Share is ON
     un-approves, bumps the Proposal Version and alerts Martha in Slack. Read from the live automation 2026-11-03. */
  GUARDRAIL_WATCHED: ["students","chaps","arrival","departure","activities","itinLinks","sessions","fullDays","arrDepDays","buses","boatTrips","location","grade","discount","upliftOverride","freeChapOverride","manualVendorEst","addVendor","taxExempt","materialsFee"],

  /* First safe edit candidates (Phase 3, dry-run only today). type drives validation. */
  EDITABLE: {
    contact:   {label: "Primary contact name", type: "text", watched: false},
    email:     {label: "Contact email", type: "email", watched: false},
    phone:     {label: "Contact phone", type: "text", watched: false},
    nextAction:{label: "Next action", type: "text", watched: false},
    followUp:  {label: "Follow-up date", type: "date", watched: false},
    internalNotes:{label: "Internal notes", type: "text", watched: false},
    customerNotes:{label: "Customer-facing notes", type: "text", watched: false},
    students:  {label: "# Students", type: "int", min: 0, max: 400, watched: true},
    chaps:     {label: "# Chaperones", type: "int", min: 0, max: 100, watched: true},
    arrival:   {label: "Arrival date", type: "date", watched: true},
    departure: {label: "Departure date", type: "date", watched: true},
    sessions:  {label: "Campus sessions", type: "int", min: 0, max: 40, watched: true},
    buses:     {label: "# Buses (Pennekamp)", type: "int", min: 0, max: 20, watched: true},
    boatTrips: {label: "# Boat snorkel/dive trips", type: "int", min: 0, max: 6, watched: true}
  }
};
