# REEF Booking Program Manager

Internal staff workspace for REEF school and group bookings. Static site (HTML/JS), same architecture as the REEF Scheduling Dashboard: hosted on GitHub Pages, and each person pastes their own Airtable personal access token. **Separate from the public school proposal pages (`reef-program-pages`). Do not merge them.**

## Rules for this repo
- No tokens, no booking data, no rates, no school names, ever. Airtable base/table/field IDs are fine (structure only).
- Pricing constants are read at runtime from the Airtable `Rates` table (by Rate Key). Change prices in Airtable, not here.
- Writes are OFF (`WRITES_ENABLED=false` in `js/config.js`). Do not change without Martha's written approval and a passing run of the internal Controlled Editing Plan (kept in REEF Dropbox, not in this repo).
- The "Staff view / Pricing view" selector only changes what is displayed. A token can read every field in the base. Do not treat it as access control.

## Files
`index.html` shell and token screen · `js/config.js` IDs and safety switches · `js/adapter-airtable.js` the only file that talks to Airtable (swap this to change hosting/auth) · `js/pricing.js` read-only mirror of Airtable's formulas, checked against Airtable's stored total · `js/edits.js` dry-run edit planner and guarded commit · `js/app.js` UI · `tests/run.js` Playwright tests against synthetic data.

## Run locally
`python3 -m http.server 8080` then open http://localhost:8080 and paste a token.
Tests: `npm i playwright && node tests/run.js` (synthetic data, no network, no token).

## Token
Create at Airtable > Developer hub > Personal access tokens. Scope `data.records:read`, access limited to the **REEF Bookings | PILOT** base. Tokens cannot be limited to tables or fields.
