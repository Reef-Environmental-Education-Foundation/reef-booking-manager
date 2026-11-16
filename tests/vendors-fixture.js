/* SYNTHETIC fixture for the vendor and rate picker tests. Made-up vendors, made-up prices, no real bookings or schools. */
const R = { key: "fldRYBqehbV1cckD9", name: "fldadLk6n35nhrTv3", cat: "fldzbw4Aurpts8776", vendor: "fldNcPkwaDQiOkJ1n", vendorName: "fldjDksddglOGCstH", cur: "fldoteimNwlYE0l6g", num: "fldgwo9ZQv09nEFhr", unit: "fldzag1pINQmNbX9S", eff: "fld6VhsDbajSsIlAv", active: "fldfbnyHWr1Lu2YEI", notes: "fldZ4XX8ZTKiMuRq2", status: "fldcZViXxZuaWm791", avail: "fldcOWfy9rUIpSQy9", acts: "fldw9PSxujfzQ7uwi" };
const VN = "fldJXlYdLLboDvdDU", AN = "fldkS3bfc5eMBvXW6";
const mk = (id, fields) => ({ id, createdTime: "2026-01-01T00:00:00.000Z", fields });
const CONF = "Confirmed", PEND = "Pending Vendor Confirmation", PLACE = "Placeholder — Not Real", AV = "Available", CBB = "Confirm Before Booking", NA = "Not Available";

const vendors = [["recVA", "Alpha Marine"], ["recVB", "Bravo Charters"], ["recVD", "Delta Dives"], ["recVZ", "Zulu Boats"], ["recVY", "Yankee Boats"], ["recVP", "Coastal Park"], ["recVE", "Echo Kayaks"]].map(([id, n]) => mk(id, { [VN]: n }));
const activities = [["recACTS", "Boat Snorkel"], ["recACTD", "Boat Dive"], ["recACTK", "Kayaking"], ["recACTP", "Pennekamp"]].map(([id, n]) => mk(id, { [AN]: n }));
const rate = (id, key, vendor, cat, value, unit, o) => { o = o || {}; const f = { [R.key]: key, [R.name]: o.name || key.replace(/_/g, " "), [R.cat]: cat, [R.vendor]: [vendor], [R.unit]: unit || "$/person", [R.status]: o.status || PEND, [R.avail]: o.avail || CBB };
  if (value != null) f[o.num ? R.num : R.cur] = value; if (o.eff !== null) f[R.eff] = o.eff || "2027-01-01"; if (o.notes) f[R.notes] = o.notes; if (o.active) f[R.active] = true; return mk(id, f); };
const rates = [
  rate("recR1", "alpha_snorkel_pp_2027", "recVA", "Boats", 75, "$/person", { notes: "Check-in 8:30 AM. Gear included. REEF staff free." }),
  rate("recR1b", "alpha_snorkel_pp", "recVA", "Boats", 60, "$/person", { eff: "2026-01-01", status: CONF, avail: AV, active: true, name: "Alpha snorkel per person (2026 sheet)" }),
  rate("recR2", "alpha_dive_pp_2027", "recVA", "Boats", 95, "$/person", { notes: "Check-in 7:30 AM" }),
  rate("recR3", "alpha_dive_guide_first_2027", "recVA", "Boats", 50, "$/person"),
  rate("recR4", "alpha_dive_guide_additional_2027", "recVA", "Boats", 30, "$/person"),
  rate("recR5", "alpha_snorkel_capacity", "recVA", "Boats", 30, "passengers", { num: true, eff: null, status: CONF, avail: AV }),
  rate("recR6", "alpha_dive_capacity", "recVA", "Boats", 20, "passengers", { num: true, eff: null, status: CONF, avail: AV }),
  rate("recR7", "alpha_gear_full_2027", "recVA", "Gear Rental", 25, "$/person"),
  rate("recR8", "bravo_snorkel_half_day_charter_2027", "recVB", "Boats", 900, "$/boat/half-day", { status: CONF, avail: AV, notes: "Check-in 9:00 AM" }),
  rate("recR9", "bravo_snorkel_capacity", "recVB", "Boats", 15, "passengers", { num: true, eff: null, status: CONF, avail: AV }),
  rate("recR10", "bravo_snorkel_gear_2027", "recVB", "Gear Rental", 25, "$/person", { status: CONF, avail: AV }),
  rate("recR11", "bravo_boat_halfday", "recVB", "Boats", 850, "$/boat/half-day", { eff: "2026-01-01", status: CONF, avail: AV, name: "Bravo half-day (older key, no service word)" }),
  rate("recR12", "delta_dives_snorkel_pp_2027", "recVD", "Boats", 80, "$/person", { status: CONF, avail: AV }),
  rate("recR13", "delta_dives_dive_pp_2027", "recVD", "Boats", 100, "$/person", { status: CONF, avail: AV }),
  rate("recR14", "delta_dives_snorkel_capacity", "recVD", "Boats", 40, "passengers", { num: true, eff: null, status: CONF, avail: AV }),
  rate("recR15", "zulu_snorkel_pp_2027", "recVZ", "Boats", 10, "$/person", { status: PLACE, avail: AV }),
  rate("recR16", "yankee_snorkel_pp_2027", "recVY", "Boats", 20, "$/person", { status: CONF, avail: NA }),
  rate("recR17", "coastal_park_entrance", "recVP", "Pennekamp", 8, "$/vehicle", { eff: "2026-01-01", status: CONF, avail: AV }),
  rate("recR18", "coastal_park_snorkel_adult_2027", "recVP", "Pennekamp", 12, "$/person"),
  rate("recR19", "echo_kayak_double_2027", "recVE", "Kayaks", 50, "$/kayak", { status: CONF, avail: AV }),
  rate("recR20", "alpha_gbb_adult_2027", "recVA", "Boats", 30, "$/person"),
  rate("recR21", "delta_dives_snorkel_pp_2028", "recVD", "Boats", 90, "$/person", { eff: "2028-01-01", status: CONF, avail: AV })
];
const rateById = {}; rates.forEach(r => { rateById[r.id] = r; });
module.exports = { R, VN, AN, mk, vendors, activities, rates, rateById, CONF, PEND, PLACE, AV, CBB, NA };
