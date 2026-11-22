# Plan Review — Banking Transactions API

| | |
|---|---|
| **Reviewed** | [product-execution-plan.md](product-execution-plan.md), [technical-implementation-plan.md](technical-implementation-plan.md) |
| **Checked against** | [TASKS.md](../TASKS.md), [README.md](../README.md) template |
| **Reviewer role** | Independent Senior Software Architect / Product Reviewer |
| **Verdict** | Initially **not approved** (1 Critical, 1 High). See [Section 4](#4-resolution) for how each finding was resolved. |

Severity scale:
- **Critical:** a required deliverable or requirement is missing.
- **High:** a contradiction that leads to incorrect behaviour.
- **Medium:** an ambiguity or gap that will cause rework or a visible defect.
- **Low:** inconsistency or polish.

---

## 1. Answers to the review questions

| # | Question | Answer |
|---|---|---|
| 1 | Does the technical plan cover all approved product requirements? | **Yes, for FR-1 to FR-8.** Every FR and every [Tech] item in product §9.3 has an implementation approach. |
| 2 | Are there requirements without an implementation approach? | **Yes.** The TASKS.md deliverables for screenshots, AI-usage documentation and the README header fields are in neither plan (F1). |
| 3 | Does the technical plan add functionality outside the approved scope? | **Slightly.** `failureReason` is not in the product plan (F4), and the timestamp-offset rule is stricter than the product decision (F5). Everything else is tooling, not product behaviour. |
| 4 | Are there contradictions between the documents? | **Yes.** D11 vs AD-5 (F2); D1/D21 vs R2 (F5); `failureReason` (F4); the dependency diagram (F9). |
| 5 | Are the dependencies and implementation order logical? | **Mostly.** Phase order and the task graph are sound. There are small inconsistencies (F8, F9). |
| 6 | Are there missing technical decisions? | **Yes.** Summary zero-fill (F6), non-JSON `Content-Type` (F13), and `+` in query date-times (F5). |
| 7 | Are there architectural risks or unnecessary complexity? | **Low risk overall.** Some duplicated demo tooling (F11). The UF-2 "failed on empty server" risk is perception, not architecture (F12). |
| 8 | Are the acceptance criteria achievable and verifiable? | **Mostly.** Phase 5 "every FR covered" has no traceability mechanism (F7). The `MAX_AMOUNT` boundary tests are fragile (F2). |

---

## 2. Findings

### F1 — Required submission deliverables are missing from both plans
- **Severity:** Critical
- **Affected:**
  - product plan §3.1 (In scope) and Phases 6–7;
  - technical plan §15 (tasks T6.x, T7.x).
- **Explanation:**
  - TASKS.md requires these deliverables:
    - `docs/screenshots/` with AI tool interactions (prompts and generated code), the API running, and sample requests and responses;
    - a PR documenting the work.
  - The README template also requires *Student Name*, *Date Submitted* and *AI Tools Used*.
  - Neither plan contains any of these. T7.1 covers README features, decisions and API reference only.
  - The original [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) had them (`docs/AI_USAGE_LOG.md`, screenshot steps, the PR block), but they were lost when it was split into two documents.
  - AI-usage documentation and screenshots are graded deliverables. Without them the submission is incomplete even if the API is perfect.
- **Recommended action:**
  - Add "AI-usage documentation and screenshots" to product §3.1 and to the Phase 7 deliverables and acceptance criteria.
  - In the technical plan, add these tasks:
    - **T7.3:** capture screenshots into `docs/screenshots/` with descriptive names;
    - **T7.4:** README header fields and an "AI tools used" section (prompts, workflow, what was verified manually);
    - **T7.5:** a PR description with an embedded summary, how to verify, and screenshots.
  - Screenshot capture should happen *during* each phase, not only at the end. Make it part of each phase's DoD.

### F2 — The maximum-amount guarantee (D11) no longer holds without BigInt
- **Severity:** High
- **Affected:** product plan FR-4.1 and D11; technical plan AD-5 and §11 (edge cases).
- **Explanation:**
  - D11 says the maximum amount exists to "prevent balances being calculated with errors".
  - AD-5 still sets `MAX_AMOUNT = Number.MAX_SAFE_INTEGER / 100` (about 90 trillion), but now sums totals with plain `Number`.
  - So two deposits of 60 trillion each are both valid, yet their sum exceeds `MAX_SAFE_INTEGER` hundredths. The balance becomes imprecise, and the funds check can then give the **wrong status**. This directly contradicts D11.
  - Separately, at about 9 × 10¹³ the spacing between doubles is about 0.016. That makes the planned `MAX_AMOUNT` / `MAX_AMOUNT + 0.01` boundary tests depend on float representation, so they are fragile.
- **Recommended action:**
  - Replace the limit with a round business limit, for example `MAX_AMOUNT = 1,000,000,000.00`. Sums then stay exact for about 90,000 maximum-size transactions per account and currency, and the boundary tests use clean numbers.
  - Update the D11 wording, which currently says "without inventing a business limit". This is a product-owner decision.
  - The alternative is to restore BigInt sums. That is more code for no practical benefit.

### F3 — A popular-currency subset rejects valid ISO 4217 codes
- **Severity:** Medium
- **Affected:** product plan FR-4.3 and D18; technical plan AD-7 and §6.1.
- **Explanation:**
  - TASKS.md says "only accept valid ISO 4217 currency codes (USD, EUR, GBP, JPY, etc.)".
  - With a 14-code list, `INR`, `BRL` or `MXN` are rejected with the spec's example message "Invalid currency code", although they *are* valid.
  - Source-of-truth rule 1 says the specification wins. A subset is a defensible interpretation, but only if it is presented honestly.
- **Recommended action:**
  - Use the message "Unsupported currency code" (or list the supported codes in the message).
  - List the supported codes in the README API reference and in Known limitations.
  - Record in D18 that the subset is a deliberate scope choice.

### F4 — `failureReason` is in the technical contract but not in the product plan
- **Severity:** Medium
- **Affected:**
  - technical plan §5.2, §6.1 and §11 ("approved in review");
  - product plan FR-1.7 and D2.
- **Explanation:**
  - The technical plan adds a public response field, `failureReason: "INSUFFICIENT_FUNDS"`, that is not in the TASKS.md transaction model.
  - The technical plan claims it was approved, but the product plan, which owns product behaviour, never mentions it.
- **Recommended action:** add it to FR-1.7 and D2 in the product plan, or remove it from the technical contract.

### F5 — The timestamp offset rule is stricter than the product decision, and `+` in query strings breaks
- **Severity:** Medium
- **Affected:**
  - product plan FR-1.3, D1 and D21;
  - technical plan AD-6, §6.2 and R2 (Proposed).
- **Explanation:**
  - The product plan accepts "a valid ISO 8601 date-time". ISO 8601 allows local times without an offset, such as `2024-01-15T10:30:00`. R2 rejects those, which changes product behaviour from inside the technical plan.
  - The same rule applies to the `from`/`to` filters. In a URL query, `?from=2024-01-15T10:30:00+02:00` decodes `+` as a space, so a correctly written offset returns 400 unless the client encodes it as `%2B`.
- **Recommended action:**
  - Approve R2 explicitly in D1 and D21, or relax it.
  - Document the `%2B` requirement in the API reference, or accept a space before the offset as `+`.
  - Add one test for each case.

### F6 — Summary totals are underspecified for currencies that appear on only one side
- **Severity:** Medium
- **Affected:** product plan FR-6.3 and FR-6.4; technical plan §6.5.
- **Explanation:**
  - Take an account with only USD deposits. Does `totalWithdrawals` return `{}` or `{"USD": 0}`?
  - The invariant "for each currency, deposits − withdrawals = balance" depends on the answer.
  - The balance rule (a currency is listed if it has any completed transaction, and a net zero shows as `0`) suggests zero-filling, but the summary contract doesn't say so.
- **Recommended action:**
  - State that both total maps contain the same currency keys as the balance, zero-filled.
  - Add a test for the one-sided case.

### F7 — "Every FR is covered by a test" cannot be verified as written
- **Severity:** Medium
- **Affected:** product plan Phase 5 acceptance criteria; technical plan §11.
- **Explanation:** nothing maps tests to requirement IDs, so a reviewer cannot check the claim without reading every test.
- **Recommended action:**
  - Prefix test names with FR or D IDs, for example `it('FR-4.1 rejects 3 decimal places')`.
  - Alternatively, add a short traceability table (FR → test file) to the README or a docs file.

### F8 — Inconsistent validator contract and critical path
- **Severity:** Low
- **Affected:** technical plan §2 (request flow), §3 (layer table), §10.1 and §15 (critical path).
- **Explanation:**
  - §3 defines validators as pure functions that return `{field, message}[]`.
  - §2 and §10.1 say validators *throw* `ValidationError`.
  - The critical path lists `T0.3 → T1.4`, but in the task table T1.4 does not depend on T0.3.
- **Recommended action:**
  - Choose one contract. The recommendation is that validators return `details` and routes or services throw `ValidationError`.
  - Align the critical path with the task table.

### F9 — Dependency and coverage-gate timing are inconsistent
- **Severity:** Low
- **Affected:** product plan §8 diagram, Phase 6 and D7; technical plan T0.6.
- **Explanation:**
  - The product diagram shows Phase 5 → 6 → 7 as a chain, but Phase 6 (and T6.x) depends only on Phases 1–4.
  - D7 says coverage is enforced in Phase 5, while T0.6 configures the threshold in Phase 0.
  - Neither causes harm, but they read as contradictions.
- **Recommended action:**
  - Show Phase 6 as parallel to Phase 5 in the diagram.
  - State that the threshold is configured in Phase 0 but becomes a DoD gate only in Phase 5.

### F10 — Document status is stale, and unreviewed items apply by default
- **Severity:** Low
- **Affected:** product plan header; technical plan header and §16.
- **Explanation:**
  - The product plan still says its companion is "to be written separately".
  - The technical plan says "Architecture reviewed", while R1–R5 are still *Proposed*, and "Proposed" means "applies unless rejected". Unreviewed behaviour, such as R1 (`null` account fields) and R4, would therefore ship silently.
- **Recommended action:**
  - Update the product plan header to link the technical plan.
  - Approve or reject R1–R5 explicitly before Phase 1 starts.

### F11 — Some tooling goes beyond what the homework needs
- **Severity:** Low
- **Affected:** technical plan §4, T6.2 and T6.4; product plan Phase 6.
- **Explanation:** TASKS.md asks for `sample-requests.http` **or** `.sh`, and `run.sh` **or** `.bat`. The plan builds both request formats, plus both `seed.js` and `seed.sh`. That is more to keep in sync with the API.
- **Recommended action:**
  - Keep one sample-request format, `.http`, since it is the easiest to screenshot.
  - Keep one seeding entry point, `seed.js`, called from `run.sh` or documented in HOWTORUN.
  - The rest is optional.

### F12 — Spec sample requests on a fresh server give a `failed` transfer
- **Severity:** Medium
- **Affected:** product plan D2 and UF-2; technical plan T6.2, T6.3 and T7.2.
- **Explanation:**
  - This behaviour is decided and documented. Still, a reviewer who starts the server and pastes the TASKS.md `curl` gets `"status": "failed"`, and may read it as a bug.
  - Functionality is the largest part of the grade.
- **Recommended action:**
  - Make seeding the obvious default. For example, `run.sh` offers to seed, or HOWTORUN puts "load sample data" directly before the sample requests, with a one-line explanation of why.
  - Also mention it in the PR description.

### F13 — No decision for non-JSON `Content-Type`
- **Severity:** Low
- **Affected:** technical plan §6.7, §10.1 and AD-2.
- **Explanation:**
  - `express.json()` ignores bodies whose `Content-Type` is not JSON, so `req.body` is `undefined`. AD-2 says this is "handled explicitly", but the response is not specified.
  - The choices are 400 with `field: "body"` or 415.
- **Recommended action:** specify 400 `{"error":"Validation failed","details":[{"field":"body","message":"Request body must be a JSON object"}]}` (consistent with FR-7.2) and add a test.

---

## 3. Approval conditions

| Condition | Findings |
|---|---|
| **Must fix before approval** | F1, F2 |
| **Should fix before Phase 1** | F3, F4, F5, F6, F10 |
| **Fix during implementation** | F7, F8, F9, F11, F12, F13 |

The plans will be re-reviewed once F1 and F2 are resolved.

---

## 4. Resolution

Both plans were updated after this review.

| Finding | Resolution |
|---|---|
| F1 | **Out of plan scope, by owner decision.** Screenshots, the README header fields, AI-usage documentation and the PR are tracked by the author directly, not in the plans. |
| F2 | Fixed. `MAX_AMOUNT` = 1,000,000,000.00. D11 and FR-4.1 were updated in the product plan, and AD-5, the edge cases and the known limitations in the technical plan. |
| F3 | Fixed. The message is "Unsupported currency code. Supported: …", and the list is documented in the README. D18, FR-4.3 and AD-7 were updated. |
| F4 | Fixed. `failureReason` was added to FR-1.7 and D2. |
| F5 | Fixed. A timezone is required (D1, D21, FR-1.3, FR-5.3). The handling of `+` / `%2B` is in AD-6, with a test and a known limitation. |
| F6 | Fixed. The total maps are zero-filled to the balance's currencies (FR-6.3, §6.5). |
| F7 | Fixed. Test names start with FR, D or AD IDs (§11, Phase 5 acceptance criteria). |
| F8 | Fixed. Validators return `details` and routes throw. The critical path was corrected. |
| F9 | Fixed. Phases 5 and 6 run in parallel in the diagram. The coverage threshold is configured in Phase 0 and becomes a DoD gate in Phase 5. |
| F10 | Fixed. Headers were updated, and R1–R5 were approved. |
| F11 | Fixed. Only `sample-requests.http` and `seed.js` remain. |
| F12 | Fixed. `run.sh` seeds by default (`--no-seed` skips it). HOWTORUN and README explain the empty-system case. |
| F13 | Fixed. A missing or non-JSON `Content-Type` gives 400 with `field: "body"`, and an edge-case test was added. |

**Verdict after the fixes:** approved for implementation. F1 remains the author's responsibility outside the plans.
