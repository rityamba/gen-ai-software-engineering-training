# Report template

Follow this structure and these field names exactly. Omit a section only when it is genuinely empty, and say so in one line rather than deleting the heading — a missing section reads as "forgotten" to the next agent.

---

# Branch Review — `<branch>` → `<base>`

**Date:** YYYY-MM-DD
**Range:** `<base-sha>`..`<head-sha>` (merge-base diff), `<N>` commits
**Changed:** `<M>` files, +`<added>` / −`<deleted>`; uncommitted changes: included / none
**Reviewed in depth:** `<list or "all changed files">`
**Not reviewed / out of scope:** `<list, or "none">`
**Verification performed:** `<e.g. read all changed files and their call sites; ran `npm run typecheck` and `npm test` — both pass>`
**Not verified:** `<e.g. DB index on orders.user_id; behaviour under concurrent requests>`

## 1. Verdict

`<2–5 sentences: merge / merge after must-fixes / do not merge, and the reason. Say what the branch does well before the problems — it sets the calibration.>`

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| Informational | 0 |

**Blocking merge:** `BR-001, BR-004` (or "none")

## 2. Top risks

1. `<one line each, the two or three things most likely to hurt in production, with the finding ID>`

## 3. Instructions for the fixing agent

Copy this block verbatim into the report:

> - Fix only the findings listed below, by ID. No opportunistic refactoring, reformatting, dependency bumps, or changes to files not named in a finding.
> - Work in order: Critical → High → Medium → Low, respecting the `Dependencies` field of each finding.
> - Keep each change as small as the fix allows, and consistent with the conventions of the surrounding code.
> - Line numbers may shift as you work. Locate each finding by its anchor snippet and the symbol name, not the line number alone. If the anchor no longer exists, skip the finding and report it as stale.
> - A finding marked `Needs decision` must not be fixed autonomously — stop and ask the human.
> - Satisfy the `Acceptance criteria` of each finding, and add or update the test named there when one is specified.
> - After each finding, run the project's type check, linter and test suite. If a fix breaks an existing test, stop and report rather than editing the test to pass.
> - Report back per ID: fixed / skipped / blocked, with a one-line reason and the commit or diff for each.

## 4. Findings

Ordered by severity, then by file.

### BR-001 — `<short imperative title>`

- **Severity:** Critical | High | Medium | Low | Informational
- **Category:** Security | Correctness | HTTP/API | Reliability | Performance | Architecture | Code Quality | Testing | Operability
- **Confidence:** verified | unverified — `<what would confirm it>`
- **Location:** `path/to/file.ext:120-134` `<add further locations if the same root cause appears elsewhere>`
- **Anchor:**
  ```ts
  <3–8 lines of the actual current code, enough to find it after line numbers shift>
  ```
- **Problem:** `<what is wrong, in one or two sentences>`
- **Why it matters:** `<the concrete consequence: the input, the sequence, or the actor that turns this into a real failure>`
- **Evidence:** `<the traced path, the call site, the test that passes for the wrong reason, the standard that defines the behaviour>`
- **Fix:** `<specific and actionable; a short snippet when it removes ambiguity>`
- **Acceptance criteria:** `<the observable condition that proves it is fixed>`
- **Dependencies:** none | apply after BR-00X
- **Reference:** `<RFC section, OWASP entry, official docs — only when there is a real one>`

### BR-002 — …

## 5. Missing tests

One row per scenario worth adding. Name what the test must assert, not "add more coverage".

| ID | Related finding | Scenario | Must assert |
|---|---|---|---|
| T-01 | BR-003 | Concurrent PATCH on the same order | Second request fails with 412 and the first write is not lost |

## 6. HTTP/API compliance

Include only when the branch touches HTTP or API surface. Status per area, with evidence.

| Area | Status | Evidence |
|---|---|---|
| Methods and semantics | Compliant / Partially compliant / Non-compliant / N/A / Not verified | `<finding IDs or a one-line observation>` |
| Status codes | | |
| Headers | | |
| Request/response contracts | | |
| Error responses | | |
| Caching and concurrency | | |
| Idempotency | | |
| REST design | | |

## 7. Positive observations

`<Decisions worth keeping, so the fixing agent doesn't undo them while fixing something nearby. Be specific.>`

## 8. Open questions and decisions needed

| ID | Question | Why it needs a human | Options |
|---|---|---|---|
| Q-01 | `<…>` | `<…>` | `<A vs B with the trade-off>` |
