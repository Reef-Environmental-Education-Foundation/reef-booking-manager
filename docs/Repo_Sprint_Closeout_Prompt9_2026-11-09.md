# Closeout: Prompt 9, Booking Manager live editing (Sandbox vs Live), 2026-11-09

## What Martha must do
1. **(Required, 2 min) Decide how the base branch gets fixed.** The prompt said `main` = v0.4. It is not: `origin/main` is v0.3 (225876e). v0.4 (fb7ee61) exists only on `origin/claude/changes`, and the checkout I was given had an extra unreviewed commit (b70c502, meals and lodging panel) on `feature/meals-lodging-panel`. You chose "v0.4 exactly", so this PR branches from fb7ee61 and targets `main`; the PR therefore also contains the v0.4 commit until that is merged. The meals/lodging commit is NOT included.
2. **(Required, 10 min) Review the PR and merge it.** Not merged by me.
3. **(Required, after merge, ~30 min) Run the go-live checklist in the README on a ZZZ record.** Flags ship as `WRITES_ENABLED: false` and `WRITES_TEST_RECORDS_ONLY: true`; I did not touch them.
4. **(Required before step 3) Create a write-scoped token** (`data.records:write`) limited to the pilot base.
5. **(Optional, 2 min) Check the Communications Log "Date" and "Direction" columns** for the new rows. The app writes What, Summary, Details and Booking only, so a log view filtered on Date may not show them.
6. **(Optional) Decide whether the change log should move to a dedicated table.** It is one function (`writeChangeLog`), so the swap is small.

## Result
- Tests: 64 passed before, 158 passed after, 0 failed. Two existing assertions were reworded because the spec changed their wording: the old "Save is disabled" preview button no longer exists in Sandbox, and the approval warning now reads "un-approve the proposal, raise the Proposal Version from N to N+1".
- All other existing tests pass unchanged (reconcile check, read-only screens, refresh, no-write guarantees).

## Interpretations and small additions (please skim)
- Required checkbox for accepted versions applies only when a watched field changes (same gate the old warning used), not for notes-only edits.
- Students and chaperones cannot be blank (blank would clear the count in Airtable). Dates must be real calendar dates.
- Price lines in the confirmation box show Vendors as one line including crew gratuities, matching the existing Martha 2026-11-07 convention rather than listing gratuities separately. Sales tax is not modeled by the calculator, so the box says Airtable calculates it.
- Date changes can change the number of program days (a formula in Airtable the calculator cannot predict), so the box warns the after-price assumes day counts stay the same.
- The edit form now keeps typed values per booking in memory, so auto-refresh and post-save re-reads never wipe typing. If Airtable changes the booking after you start typing, the form says so and saving is refused.
- Added an optional `CHROMIUM_PATH` env var to the test launcher (no effect when unset).

## Could not verify
- Nothing was run against real Airtable. All write behavior is verified against a mocked `fetch` and mocked network responses, by design.
- Slack alert, un-approval and version bump are simulated in the mock based on the guardrail description; Step 4 of the checklist is the real proof.
- Safari and Firefox were not tested (Chromium only). The confirmation box uses the native `<dialog>` element.
- Screen reader behavior was not tested. Keyboard use (Tab, Enter, Esc, focus kept inside the dialog) is covered by tests.
