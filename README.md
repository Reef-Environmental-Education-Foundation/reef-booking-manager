# REEF Booking Program Manager

Internal staff workspace for REEF school and group bookings. Static site (HTML/JS), same architecture as the REEF Scheduling Dashboard: hosted on GitHub Pages, and each person pastes their own Airtable personal access token. **Separate from the public school proposal pages (`reef-program-pages`). Do not merge them.**

## Rules for this repo
- No tokens, no booking data, no rates, no school names, ever. Airtable base/table/field IDs are fine (structure only).
- Pricing constants are read at runtime from the Airtable `Rates` table (by Rate Key). Change prices in Airtable, not here.
- Writes ship OFF (`WRITES_ENABLED=false`, `WRITES_TEST_RECORDS_ONLY=true` in `js/config.js`). Only Martha flips them, after testing on a ZZZ record (checklist below). Do not change them in a PR.
- Airtable is the single source of truth. The app never changes Airtable schema, formulas or automations, never touches the proposal pages, and never sends anything to a school. Publishing stays a separate manual workflow.
- The "Staff view / Pricing view" selector only changes what is displayed. A token can read every field in the base. Do not treat it as access control.

## Files
`index.html` shell and token screen · `js/config.js` IDs and safety switches · `js/adapter-airtable.js` the only file that talks to Airtable (swap this to change hosting/auth) · `js/pricing.js` read-only mirror of Airtable's formulas, checked against Airtable's stored total · `js/mode.js` Sandbox/Live state · `js/edits.js` edit planner, guarded commit, change log, post-save verification · `js/budget-margin.js` Budget & Margin tab · `js/pipeline.js` Pipeline screen (read-only board of where each active booking is in the sales process) · `js/app.js` UI · `tests/run.js` unit tests (vm, mocked `fetch`) plus Playwright tests against synthetic data.

## Budget & Margin tab (internal, read-only)
`js/budget-margin.js` renders a Budget & Margin tab (Pricing & costs view only): revenue, hard costs line by line, staff and campus cost, and net dollars and percent, side by side for sibling options (same school, arrival within 3 weeks) plus a "Compare with" picker. It only displays Airtable's own results (Program Revenue, Total Program Cost, Program Margin) and flags any place where the lines do not add up to them. It never writes and never recalculates prices. Staff hours come from the Airtable formula (10 hrs per full day, 5 per arrival/departure day, x1.25 prep, $35/hr). Test: `node tests/budget-margin.js` (synthetic data).

## Pipeline screen (read-only)
Left nav, under Today. Five columns: Drafting, Proposal sent, Said yes, Contract sent, Signed, each with count, dollar total and whose move it is. A booking is placed by contract status first (Sent, unless Status is Confirmed or In Progress), then Signed / Confirmed / In Progress, then Status. Completed, Cancelled and test records (name or organization starting with `TEST_PREFIX`) are left out and counted in the footer. "Needs a look" lists blank Proposal Sent Date, school replies, no reply with the program `PIPELINE_NO_REPLY_DAYS` (45) or fewer days out, and a blank Deposit/Payment Status on signed bookings. Customer-facing figures only; reads no cost or margin field. For a booking to appear under Contract sent, Agreement/Contract Status must be set to Sent in Airtable.

## Sandbox vs Live (v0.5)
The app opens in **Sandbox** every time (never remembered). A sticky bar on every screen says which mode you are in.
- **Sandbox (blue)**: "SANDBOX - nothing is saved." The Edit tab's **Check price (test only)** shows what a change would do to the price and the approval. It can never write.
- **Live (red, thick red border)**: "LIVE - changes save to Airtable." **Review change** opens a confirmation box: each field as `Label: old -> new`, customer-facing price before/after, what happens next (un-approval, version bump, schedule not moved, text that can appear on school pages), a required reason (10+ characters) and, when it un-approves a proposal or changes accepted terms, a required checkbox. Only then **Save live change** is enabled.
- Live is available only when `WRITES_ENABLED` is true and the token has `data.records:write`; otherwise the switch is disabled with the reason. Live returns to Sandbox after 15 minutes idle (`LIVE_IDLE_MS`, countdown in the last 2 minutes), and when the token is cleared or stops verifying. Typed values stay in the form marked "not saved".
- Each live save sends one PATCH with only the changed fields (`typecast:false`), then writes a Communications Log row (What = "Other", Summary `App edit: <fields>`, Details = before -> after, reason, editor email, version). The log lives behind one function, `writeChangeLog`, so a dedicated table can replace it. If the log write fails, the screen says so and offers the exact text to copy.
- After saving, the app re-reads the booking, waits for Airtable's formulas and the guardrail to settle (about 1.5s, then up to 2 more reads at 2s) and shows Airtable's recalculated total against the calculator's expected total, plus the observed Approved flag and Proposal Version against what was predicted. Airtable is always right; a difference means the calculator needs fixing.
- **Editable in v1**: # students (0-400), # chaperones (0-100), arrival and departure dates, internal notes, customer-facing notes, special requests, next action, follow-up date. Everything else (program fees, vendor overrides, discounts, uplift, free-chaperone override, tax exempt, materials fee, additional vendor costs, sessions, buses, boat trips, contact fields) stays read-only. Activity swaps come later.
- **Safety gates** (all must pass, in `ReefEdits.commit`; `ReefData._patch/_create` also refuse outside Live): Live mode, confirmed, reason, valid plan, `WRITES_ENABLED`, ZZZ-only rule (`WRITES_TEST_RECORDS_ONLY` + `TEST_PREFIX`), token can write, and the record unchanged since you started editing.

## Go-live checklist for Martha (run after merge, in order, on a ZZZ record)
1. Set `WRITES_ENABLED: true` (keep `WRITES_TEST_RECORDS_ONLY: true`). Use a write-scoped token (`data.records:write`) on a ZZZ booking.
2. Change a notes field: it saves, a log row is appended, and Airtable's history shows the right person.
3. Change students on an **unapproved** ZZZ booking: price updates, no un-approve, calculator matches Airtable.
4. Same on an **approved** ZZZ copy: un-approve, Proposal Version +1, Slack alert, exactly as the confirmation box predicted.
5. Edit the same record in Airtable between load and save: the app refuses.
6. Total Package Price on all real bookings is unchanged (snapshot before and after).
7. Only then widen beyond ZZZ (`WRITES_TEST_RECORDS_ONLY: false`) and give Rose her write token. Never test on Benjamin's booking (its approval and v4 must not change).

## Run locally
`python3 -m http.server 8080` then open http://localhost:8080 and paste a token.
Tests: `npm i playwright && node tests/run.js` (synthetic data, no network, no token). If Playwright's browser is not downloaded, set `CHROMIUM_PATH` to an installed Chromium. The Live-mode tests serve a throwaway copy of `config.js` with writes enabled; the repo file stays `false`.

## Token
Create at Airtable > Developer hub > Personal access tokens. Scope `data.records:read` (add `data.records:write` only for people who will edit live), access limited to the **REEF Bookings | PILOT** base. Tokens cannot be limited to tables or fields.
