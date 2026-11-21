---
name: phase
description: Runs one implementation phase of homework-1 end to end - implement the phase from the plans, get an independent review from the branch-reviewer subagent (at most 2 review cycles), fix the findings, update the Postman collection, and stop before committing. Invoke as `/phase <number>`, for example `/phase 3`.
---

# Phase workflow

`$ARGUMENTS` is the phase number. If it is empty or not a number, look at `git log --oneline` for the last `Phase N` commit, propose `N + 1`, and ask the user to confirm before doing anything else.

Talk to the user in Ukrainian. Code, docs, test names and commit messages stay in English.

Keep the user posted with one short line at the start of each step ("Крок 2/5: рев'ю, цикл 1").

## Step 0 — Preconditions

- Run `git status --porcelain`. If there are uncommitted changes under `homework-1/` that belong to an earlier phase, stop and ask whether to commit them first. Mixing phases in one commit breaks the "each phase is committed" Definition of Done.
- Read the phase in `homework-1/docs/product-execution-plan.md` (objective, features, acceptance criteria, Definition of Done, referenced FR/D items) and its tasks `T<N>.*` in `homework-1/docs/technical-implementation-plan.md`, with the API sections and AD-x decisions they cite.
- If the plans leave a behaviour open that the implementation must decide, ask now with AskUserQuestion rather than guessing.

## Step 1 — Implement

- Implement every task of the phase, following the existing code conventions (layering routes → validators/services → store, shared constants, error contract, test naming `<FR/D id> <behaviour>`).
- Add unit and integration tests for every acceptance criterion, a valid and an invalid case per rule.
- Update earlier tests only when the new behaviour legitimately changes them, with a one-line comment why; never weaken an assertion just to make it pass.
- Run `npm test`, `npm run lint` and `npm run format:check` in `homework-1/`. All must pass before Step 2.
- Screenshot reminder (one line): suggest screenshotting the green test run, with a filename like `docs/screenshots/phase-<N>-tests.png`.

## Step 2 — Independent review (cycle 1)

Spawn the `branch-reviewer` subagent with the Agent tool. Give it only:

- `phase: <N>`, `cycle: 1`, `language: Ukrainian`
- `report_path`: `<session scratchpad directory>/phase-<N>-review-cycle-1.md` (absolute path; never inside the repository)

Do not pass your own reasoning or a summary of what you think is wrong: the value of this review is that it is not anchored on the implementation.

## Step 3 — Fix

Read the report file. Then:

- **`Needs decision` findings:** ask the user with AskUserQuestion, one question per finding, options taken from the report's Open questions table. Record each answer; if it changes a documented contract, update the relevant line in the technical plan as part of the fix.
- **Other Critical/High/Medium/Low findings:** fix them in severity order, following the report's "Instructions for the fixing agent" block (smallest change, satisfy the acceptance criteria, add the named tests).
- **Informational:** do not act; mention them in the final summary.
- A finding about the Postman collection is handled in Step 5, not here.
- Re-run tests, lint and format check.

**Cycle 2** runs only if at least one finding was fixed in this step. Spawn `branch-reviewer` again with `cycle: 2`, `report_path: <scratchpad>/phase-<N>-review-cycle-2.md`, `previous_report_path` set to the cycle-1 report, and the list of IDs you fixed or skipped (with one-line reasons). Then:

- fix any regression or unconfirmed fix it reports, re-run the checks;
- **do not start a third review cycle.** Anything still open after cycle 2 goes into the final summary for the user to decide.

## Step 4 — Collection prerequisites

Decide whether the phase added or changed HTTP behaviour (new endpoint, new query parameters, new status codes or fields, changed error messages). If it did not, skip Step 5 and say so.

## Step 5 — Update the Postman collection

File: `homework-1/postman/banking-transactions-api.postman_collection.json` (Postman v2.1 JSON). Environment: `homework-1/postman/local.postman_environment.json`.

- Make the edit with a small Node script in the scratchpad that parses, changes and re-serialises the file, and keep the existing style: 2-space indent, non-ASCII characters escaped as `\uXXXX`, trailing newline. First check that a parse/serialise round-trip of the untouched file is byte-identical, so the diff contains only your change.
- Update folder descriptions that the phase made stale.
- Add requests for the new behaviour, success and error cases, each with `pm.test` assertions in the style of the existing ones. Assert shapes and contracts, not totals that grow when the collection is run repeatedly against the same server.
- Place new folders in a sensible run order (before "Unknown routes").
- Verify: start the server on a spare port (`PORT=3999 node src/server.js` in the background), run `postman collection run <collection> --env-var baseUrl=http://localhost:3999 --env-var accountA=ACC-12345 --env-var accountB=ACC-67890` **twice in a row**, require 0 failed assertions in both runs, then stop the server.
- Screenshot reminder (one line): suggest screenshotting the collection run.

## Step 6 — Stop before commit

Report to the user, briefly:

- what the phase implemented (by acceptance criterion);
- review: findings per cycle, what was fixed, what was decided and how, what is left open;
- test count, coverage, lint, and the Postman run result;
- paths of the review reports (full absolute paths);
- a proposed commit message in the repo's style, e.g. `feat(homework-1): Phase <N> <short title>`.

Then wait. Commit only after the user explicitly says yes. Never push or open a PR from this workflow.

## Never

- Write review reports into the repository (they belong in the scratchpad).
- Add screenshots, README header fields, AI-usage notes or PR text to the plan documents: those are the user's.
- Run more than two review cycles.
