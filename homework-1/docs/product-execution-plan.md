# Product & Execution Plan — Banking Transactions API

| | |
|---|---|
| **Document type** | Product & Execution Plan (WHAT we build and in WHAT order) |
| **Companion document** | [technical-implementation-plan.md](technical-implementation-plan.md) (HOW) |
| **Requirements source** | [TASKS.md](../TASKS.md) — the requirements specification |
| **Derived from** | [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (original combined plan) |
| **Status** | Product scope agreed: every behaviour is either a requirement or decided (D1–D22, [Section 9.1](#91-decision-log)). Only technical decisions remain ([Section 9.3](#93-technical-decisions-referenced-to-be-made-in-the-technical-implementation-plan-tech)). |

---

## 1. How to read this document

### 1.1 Source-of-truth rules
1. **The requirements specification wins.** Where the original plan and the specification disagree, the specification applies.
2. **Behaviour the specification does not define** is kept from the original plan but marked as a **Proposal**. It is not final until confirmed.
3. **The sample requests in the specification are acceptance criteria.** Every one of them must produce a sensible, successful result when run in the documented flow (see D2).

### 1.2 Labels
| Label | Meaning |
|---|---|
| **[Req]** | Stated in the requirements specification. Confirmed. |
| **[Decided]** | Not in the specification. Decided in this plan, with the reasoning recorded in the [Decision log](#91-decision-log). |
| **[Proposal]** | From the original plan, not in the specification. Pending confirmation. None remain: all were accepted (D22). |
| **[Open]** | Undecided. None remain at the moment. |
| **[Tech]** | A technical decision that belongs to the Technical Implementation Plan. Mentioned here only as a reference, not resolved. |

---

## 2. Product overview and goals

### 2.1 Overview
A minimal REST API for banking transactions. Clients can record money movements (deposits, withdrawals, transfers) between accounts. They can look up individual transactions, browse and filter the history, and see the current balance and a summary for each account.

### 2.2 Goals
| # | Goal | Source |
|---|---|---|
| G1 | Clients can create transactions and retrieve them individually or as a list | [Req] |
| G2 | Clients can see an account's balance, derived from its transactions | [Req] |
| G3 | Invalid input is rejected with meaningful, field-level error messages | [Req] |
| G4 | Clients can filter transaction history by account, type and date range, alone or combined | [Req] |
| G5 | Clients can get an account summary: total deposits, total withdrawals, number of transactions, most recent transaction date | [Req] (Option A) |
| G6 | Every endpoint answers with an appropriate outcome: success, created, invalid request or not found | [Req] |
| G7 | The product's behaviour is verified by automated tests and can be reproduced with the provided sample requests and data | [Decided] |

---

## 3. Non-goals and scope boundaries

### 3.1 In scope
- Transaction creation, retrieval and listing
- Input validation
- Account balance and transaction status rules
- History filtering, including a filter by status (D15)
- Account summary (Option A)
- Health check
- Automated testing of all of the above
- Sample data, sample requests and a run script
- Project documentation: overview and how to run

### 3.2 Out of scope (non-goals)
| Item | Reason |
|---|---|
| Interest calculation (Option B) | Not selected. The specification requires at least one additional feature, and Option A was chosen. |
| Transaction export to CSV (Option C) | Not selected |
| Rate limiting (Option D) | Not selected |
| Persistent storage or a database | The specification requires in-memory storage. **Consequence:** all data is lost when the service restarts. |
| Account management (opening, closing, owners, account registry) | Not in the specification. Accounts exist only as identifiers on transactions (D4). |
| Authentication and authorization | Not in the specification |
| Currency conversion between currencies | Not in the specification. Amounts in different currencies are never combined (D3). |
| Changing or cancelling a transaction after creation | Not in the specification. The original plan treats transactions as immutable [Decided — D22]. |
| Asynchronous processing, or the `pending` status in practice | Transactions are processed immediately (D2) |
| Pagination | Not needed: data is held in memory and volumes are small (D10). Recorded as a known limitation. |
| A per-currency limit on decimal places (e.g. no decimals for JPY) | Conflicts with the specification. Deferred as a future enhancement and documented as a known limitation (D17). |
| User interface | API only |

---

## 4. Target users [Decided — D9]

| User | Needs |
|---|---|
| **API client developer**, building an app or service that records and reads banking transactions | Clear request rules, predictable responses, field-level error messages |
| **Developer or tester verifying the service** | Easy local start-up, sample requests and data, automated tests |

---

## 5. Functional requirements

### FR-1 Create a transaction — [Req]
- **FR-1.1** A client can create a transaction with:
  - source account
  - destination account
  - amount
  - currency
  - type: `deposit`, `withdrawal` or `transfer`

  [Req]
- **FR-1.2** The system generates a unique identifier for each transaction [Req]. The client cannot set it.
- **FR-1.3** Each transaction has a timestamp in ISO 8601 date-time format [Req].
  - The client **may** supply the timestamp. If it is left out, the system uses the current date and time [Decided — D1].
  - A supplied timestamp must be a valid ISO 8601 date-time **with a timezone** (`Z` or an offset such as `+02:00`) and must not be in the future [Decided — D1]. A date-time without a timezone is rejected, because it is ambiguous.
- **FR-1.4** Each transaction has a status: `pending`, `completed` or `failed` [Req]. The system always determines the status; the client cannot set it [Decided — D2].
- **FR-1.5** A successfully created transaction is confirmed with a "created" outcome [Req].
- **FR-1.6** Which account fields each type requires [Decided — D22]:
  - a deposit requires a destination account and must not have a source account;
  - a withdrawal requires a source account and must not have a destination account;
  - a transfer requires both, and they must be different.
- **FR-1.7** Status rules [Decided — D2]:
  - A deposit is always `completed`.
  - A withdrawal or transfer is `completed` if the source account has enough funds in that currency at the transaction's timestamp.
  - If it doesn't, the transaction is **still recorded**, with status `failed` and a "created" outcome. The request itself was valid; only the business operation failed, and the attempt stays visible in the history.
  - A failed transaction also states why it failed, as a machine-readable reason (`INSUFFICIENT_FUNDS`). This field is an addition to the specification's model and appears only on failed transactions [Decided — D2].
  - Funds are checked against the account's completed transactions in timestamp order, at the transaction's own timestamp. A backdated withdrawal or transfer must also leave every later balance in that currency at zero or above; otherwise it is `failed`. Transactions with the same timestamp count as earlier than the new one [Decided — D2, revised 2026-11-22].
  - `pending` is part of the model but is not assigned, because processing is immediate.
- **FR-1.8** Invalid requests are not stored [Decided — D22].

### FR-2 Retrieve transactions — [Req]
- **FR-2.1** A client can list all transactions [Req]. Failed transactions are included [Decided — D2].
- **FR-2.2** A client can retrieve one transaction by its identifier. An unknown identifier gives a "not found" outcome [Req]. An identifier in an unexpected format also gives "not found", not "invalid request" [Decided — D13].
- **FR-2.3** The list is sorted by timestamp, **newest first**, with no pagination [Decided — D10].

### FR-3 Account balance — [Req]
- **FR-3.1** A client can request an account's balance [Req].
- **FR-3.2** How the balance is calculated [Decided — D2]:
  - Only `completed` transactions count.
  - Deposits add to the destination account.
  - Withdrawals subtract from the source account.
  - Transfers subtract from the source account and add to the destination account.
- **FR-3.3** The balance is reported **separately for each currency**, and currencies are never added together [Decided — D3].
- **FR-3.4** An account with no transactions returns an **empty balance**, not "not found" [Decided — D4].

### FR-4 Validation — [Req]
- **FR-4.1** The amount must be a positive number with **at most 2 decimal places, in every currency** [Req].
  - The original plan proposed a stricter per-currency limit (for example, no decimals for JPY). Under source-of-truth rule 1 it does **not** apply. It is deferred as a future enhancement and documented as a known limitation [Decided — D17].
  - The amount must not exceed **1,000,000,000.00** (one billion) in any currency [Decided — D11].
- **FR-4.2** Account identifiers must follow the format `ACC-XXXXX`, where X is alphanumeric [Req].
  - The same check applies to the account identifier in balance and summary requests [Decided — D22].
  - The identifier is case-insensitive and is stored and returned in upper case, so `acc-abcde` and `ACC-ABCDE` are the same account [Decided — D14, revised 2026-11-22].
- **FR-4.3** The currency must be a valid ISO 4217 code [Req].
  - Every currency in active circulation in ISO 4217 is accepted. Withdrawn codes (such as `HRK`), fund codes, precious metals, `XDR` and the special codes `XXX` and `XTS` are rejected [Decided — D18, revised 2026-11-22].
  - The code must be upper case, so `usd` is rejected [Decided — D18].
  - A rejected code gets the message "Invalid currency code", as in the specification's example [Decided — D18].
- **FR-4.4** The type must be one of `deposit`, `withdrawal` or `transfer` [Req, from the model].
- **FR-4.5** A supplied timestamp must be valid and not in the future [Decided — D1].
- **FR-4.6** Invalid requests receive meaningful error messages that name each invalid field [Req]. All problems are reported together, not one at a time [Req example; Decided — D22 for "all at once"].
- **FR-4.7** Strict validation [Decided — D16]:
  - the amount must be a number, not text;
  - the request must be a structured object;
  - unknown fields are rejected;
  - malformed request content is rejected.

### FR-5 Transaction history filtering — [Req]
- **FR-5.1** Filter by account [Req]. A transaction matches if the account is its source **or** its destination [Decided — D22].
- **FR-5.2** Filter by type [Req].
- **FR-5.3** Filter by date range with "from" and "to", applied to each transaction's timestamp [Req]. Details [Decided — D21]:
  - dates may be full date-times (with a timezone, as in FR-1.3) or dates only;
  - dates only are interpreted in UTC;
  - a date-only "to" includes the whole day.
- **FR-5.4** Filters can be combined, and a transaction must match all of them [Req for combining; Decided — D22 for "all"].
- **FR-5.5** Invalid filters return an "invalid request" outcome [Decided — D16]:
  - an unknown type or status;
  - a malformed date;
  - "from" later than "to";
  - a repeated parameter;
  - an unknown parameter.
- **FR-5.6** The account filter value must follow the `ACC-XXXXX` format. Otherwise the outcome is "invalid request" [Decided — D12].
- **FR-5.7** Filter by status: `pending`, `completed` or `failed`. It combines with the other filters [Decided — D15]. This is an addition beyond the specification.

### FR-6 Account summary (Option A) — [Req]
- **FR-6.1** A client can request an account summary with total deposits, total withdrawals, number of transactions and most recent transaction date [Req].
- **FR-6.2** The number of transactions counts **all** of the account's transactions [Req].
  - The summary also reports how many of those transactions are `failed` [Decided — D19].
  - The most recent transaction date considers all of the account's transactions, including failed ones [Decided — D19].
- **FR-6.3** Totals are reported separately for each currency [Decided — D3] and include only `completed` transactions [Decided — D2]. Total deposits and total withdrawals always list the **same currencies** as the balance, with `0` where there was no movement on that side [Decided — D20].
- **FR-6.4** For the account's summary, an incoming transfer counts toward deposits and an outgoing transfer toward withdrawals. As a result, for each currency, total deposits minus total withdrawals equals the balance [Decided — D20].
- **FR-6.5** An account with no transactions returns empty totals, a count of zero and no date [Decided — D4].

### FR-7 Error outcomes — [Req]
- **FR-7.1** Responses use appropriate outcomes: success, created, invalid request and not found [Req].
- **FR-7.2** Basic error handling [Req]. Broken down as [Decided — D22]:
  - unknown routes give "not found";
  - malformed request content gives "invalid request";
  - unexpected failures give a generic server error.
- **FR-7.3** The exact error formats belong to the Technical Implementation Plan [Tech].

### FR-8 Operability
- **FR-8.1** A health check reports that the service is up [Decided — D8].

---

## 6. Main user flows

### UF-1 Fund an account and move money
1. The client creates a **deposit** into account A and receives the created transaction with status `completed`.
2. The client creates a **transfer** from A to B and receives the created transaction.
   - If A has enough funds in that currency, the status is `completed`.
   - If not, the status is `failed`.
3. The client creates a **withdrawal** from B, with the same status rules.
4. The client checks the balances of A and B. Each balance is shown per currency and reflects only completed transactions.

### UF-2 Specification sample requests (acceptance flow) [Decided — D2]
1. The documented flow starts by loading the sample data. This funds ACC-12345 through a deposit and adds transactions dated January 2024.
2. The client sends the specification's sample transfer: 100.50 USD from ACC-12345 to ACC-67890. It is recorded as `completed`.
3. The client:
   - lists all transactions;
   - lists the transactions for ACC-12345;
   - filters with `from=2024-01-01&to=2024-01-31` and gets the January 2024 sample transactions;
   - requests the balance of ACC-12345.

   All of these return meaningful results.
4. Sending the same transfer on an **empty** system gives a recorded `failed` transaction. This is expected behaviour, and the documentation says so.

### UF-3 Invalid request
1. The client sends a transaction with several invalid fields, for example a negative amount and an unknown currency.
2. The client receives an "invalid request" outcome listing **every** invalid field with a message.
3. Nothing is stored.

### UF-4 Browse history
1. The client lists transactions filtered by account.
2. The client narrows the list by type, status and date range in one request.
3. The client receives only transactions matching all filters.
4. An invalid filter gives an "invalid request" outcome that explains the problem.

### UF-5 Review an account
1. The client requests the summary of an account.
2. The client receives per-currency total deposits and total withdrawals, the number of transactions (with how many failed) and the most recent transaction date.
3. For an account with no transactions, the client receives empty totals rather than an error.

### UF-6 Look up a transaction
1. The client requests a transaction by identifier.
2. A known identifier returns the transaction. An unknown one returns "not found".

### UF-7 Developer onboarding
1. A developer follows the run instructions and starts the service with the run script, which waits until the health check reports the service is up and then loads the sample data.
2. The developer executes the sample requests and runs the automated tests.
3. Outcomes match the documentation.

---

## 7. Project phases and milestones

**Testing approach [Decided — D5]:**
- Every phase ships with automated tests for its own acceptance criteria. A phase is not done until its tests and all earlier tests pass.
- Phase 5 then adds full-system regression and edge-case coverage, and enforces the coverage target (D7).

**Phase order [Decided — D6]:** validation is delivered together with transaction creation (Phase 1), **before** balance and status rules (Phase 2). Balances and the funds check therefore never see an invalid amount, currency or account.

### Phase 0 — Foundation
- **Objective:** a runnable, empty service skeleton that the other phases build on.
- **Features and expected outcomes:**
  - The service starts locally on a configurable port.
  - It responds to a health check (FR-8.1).
  - The automated test run is set up and can execute.
- **Dependencies:** none.
- **Acceptance criteria:**
  - The service starts with one documented command and stays running.
  - The health check responds successfully.
  - The automated test command runs and reports results.
- **Definition of Done:**
  - The acceptance criteria are met, and a passing automated test covers the health check.
  - Generated and local-only artefacts are excluded from version control.
  - The change is committed.

### Phase 1 — Transaction recording and validation (FR-1 except FR-1.7, FR-2, FR-4, FR-7)
- **Objective:** clients can record valid transactions and read them back. Invalid input is rejected with field-level feedback.
- **Features and expected outcomes:**
  - Create a transaction with a generated identifier, an optional client timestamp (D1) and a status. Until Phase 2 adds the funds rule, every valid transaction is `completed`.
  - List all transactions.
  - Get a transaction by identifier, with "not found" for unknown identifiers.
  - All validation rules:
    - amount, account format, currency, type and timestamp;
    - the account-field rules for each type [Decided — D22];
    - all errors reported together;
    - the strictness rules (D16);
    - the maximum amount (D11);
    - account case rules (D14);
    - active, upper-case currency codes only (D18).
  - Basic error handling for malformed requests, unknown routes and unexpected errors.
- **Dependencies:** Phase 0.
- **Acceptance criteria:**
  - Creating a valid transaction gives a "created" outcome, and the response includes the identifier, timestamp and status.
  - A supplied past timestamp is kept. A missing one is set to the current time. A future or malformed one is rejected.
  - The new transaction appears in the list and can be retrieved by its identifier.
  - The list is sorted newest first by timestamp.
  - An unknown identifier, or one in an unexpected format, gives "not found".
  - Each invalid input below gives "invalid request", names the offending field and stores nothing:
    - zero amount;
    - negative amount;
    - more than 2 decimal places;
    - amount above the maximum;
    - amount given as text;
    - malformed account, including a lower-case `acc-` prefix;
    - unknown, inactive, special or lower-case currency;
    - unknown type;
    - invalid timestamp;
    - an unknown field.
  - A request with several invalid fields reports all of them.
  - An amount with up to 2 decimal places is accepted in any valid currency (FR-4.1).
  - Malformed request content gives "invalid request", and unknown routes give "not found".
- **Definition of Done:**
  - Passing automated tests cover every acceptance criterion, with a valid case and an invalid case for each rule.
  - Phase 0 tests still pass.
  - The change is committed.

### Phase 2 — Balance and transaction status rules (FR-1.7, FR-3)
- **Objective:** clients see correct per-currency balances, and the transaction status reflects whether the operation succeeded.
- **Features and expected outcomes:**
  - Account balance per currency, from completed transactions only.
  - The funds check for withdrawals and transfers, with `failed` status when funds are insufficient.
  - An empty balance for an account with no transactions.
  - The account identifier is checked in balance requests [Decided — D22].
- **Dependencies:** Phase 1, which provides valid stored transactions.
- **Acceptance criteria:**
  - After a deposit, a transfer and a withdrawal, the balances of the accounts involved are correct for each currency.
  - A withdrawal or transfer exceeding the funds available in that currency is recorded as `failed` with a "created" outcome, and does not change any balance.
  - Funds in another currency do not cover a transaction.
  - An account with no transactions returns an empty balance. A malformed account identifier gives "invalid request".
  - The specification's sample requests succeed in the documented flow (UF-2), with ACC-12345 funded by a deposit first.
- **Definition of Done:**
  - Passing automated tests cover every acceptance criterion, including the sample-request flow.
  - Earlier tests still pass.
  - The change is committed.

### Phase 3 — Transaction history filtering (FR-5)
- **Objective:** clients can narrow the transaction list.
- **Features and expected outcomes:**
  - Filters by account, type, status (D15), and from/to date range, usable together.
  - Invalid filters are rejected (D16).
- **Dependencies:** Phase 1 (list, client-supplied timestamps, shared validation rules). The status filter is most useful once Phase 2 produces `failed` transactions, but it does not depend on Phase 2.
- **Acceptance criteria:**
  - Each filter alone returns only matching transactions.
  - Combined filters return only transactions matching all of them.
  - The account filter matches transactions where the account is the source or the destination.
  - A date-only "to" includes transactions from that whole day, in UTC.
  - The specification's example `from=2024-01-01&to=2024-01-31` returns the transactions dated January 2024, including any on 31 January.
  - Filtered results keep the newest-first order.
  - Invalid filters give "invalid request" with an explanation:
    - unknown type or status;
    - malformed account;
    - malformed date;
    - "from" later than "to";
    - repeated or unknown parameter.
- **Definition of Done:**
  - Passing automated tests for each filter, the combinations, the boundaries and the invalid cases.
  - Earlier tests still pass.
  - The change is committed.

### Phase 4 — Account summary (FR-6)
- **Objective:** clients get an at-a-glance view of an account.
- **Features and expected outcomes:** the summary with:
  - per-currency total deposits and total withdrawals, with transfers counted as incoming or outgoing;
  - the number of transactions, and how many of them failed;
  - the most recent transaction date.
- **Dependencies:** Phase 2 (the balance and status rules, which the summary reuses).
- **Acceptance criteria:**
  - For an account with deposits, withdrawals and transfers in and out, in more than one currency, the totals are correct.
  - For each currency, total deposits minus total withdrawals equals the balance.
  - The number of transactions counts all of the account's transactions, and the failed count matches its failed transactions.
  - The most recent date is the newest of all the account's transactions, including failed ones.
  - An account with no transactions gives empty totals, a count of zero and no date.
  - A malformed account identifier gives "invalid request".
- **Definition of Done:**
  - Passing automated tests for typical, empty, mixed-currency and transfer cases.
  - Earlier tests still pass.
  - The change is committed.

### Phase 5 — Quality and regression testing
- **Objective:** confidence that the whole product behaves correctly, including edge cases.
- **Features and expected outcomes:** a consolidated automated test suite across all features, with the edge cases from the original plan where they still apply:
  - client-supplied identifier or status;
  - future and malformed timestamps;
  - forbidden account fields for a type;
  - insufficient funds in the same account and currency;
  - mixed currencies;
  - amounts with floating-point precision issues;
  - amounts given as text;
  - more than 2 decimal places;
  - repeated, unknown or malformed filter parameters;
  - inclusive end-of-day date ranges;
  - transfers in balance and summary.
- **Dependencies:** Phases 1–4.
- **Acceptance criteria:**
  - Every functional requirement (FR-1 to FR-8) and every confirmed proposal is covered by at least one automated test. This is verifiable because each test name starts with the requirement or decision ID it covers (for example `FR-4.1`).
  - The full suite passes.
  - Coverage is **at least 80%** of lines and branches [Decided — D7].
- **Definition of Done:**
  - The suite passes on a clean checkout and meets the coverage target.
  - No known defects remain open, or the ones that do are documented.

### Phase 6 — Sample data and developer tooling
- **Objective:** anyone can start the service and try it within minutes.
- **Features and expected outcomes:**
  - A run script that starts the service, confirms it is up through the health check, and **loads the sample data by default** (with an option to skip it). This way the specification's sample requests succeed right after start-up (UF-2).
  - Sample requests covering every endpoint, including error cases, arranged in the order of UF-2.
  - Sample transaction data and a way to load it into the running service. The data includes:
    - deposits first, so ACC-12345 is funded;
    - transactions dated January 2024;
    - more than one currency;
    - at least one intentionally `failed` transaction.
- **Dependencies:** Phases 1–4.
- **Acceptance criteria:**
  - On a clean machine with the documented prerequisites, the run script starts the service.
  - The sample data loads, and the only `failed` transactions are the intentional ones.
  - Every sample request returns the outcome described next to it, including all the specification's sample requests.
- **Definition of Done:** acceptance criteria verified by hand from a clean state, and committed.

### Phase 7 — Documentation
- **Objective:** the product is understandable and runnable without help from the authors.
- **Features and expected outcomes:**
  - A project overview (README) covering:
    - features;
    - key product decisions and their rationale, including D1–D4;
    - an API reference.
  - Run instructions (HOWTORUN) covering:
    - prerequisites;
    - installation;
    - starting the service;
    - configuration;
    - running tests and coverage;
    - using the sample data and requests.
- **Dependencies:** Phases 0–6. Remaining open questions are resolved, or documented as known limitations.
- **Acceptance criteria:**
  - A reader new to the project can start the service, run the tests and execute the sample requests using only the documentation.
  - Every decision and confirmed proposal is documented as product behaviour.
  - The README and HOWTORUN state that running the sample transfer on an empty system (started without sample data) gives a `failed` transaction, and why.
- **Definition of Done:** documentation reviewed against actual behaviour and committed.

### 7.1 Milestones [Decided — D5]
| Milestone | Reached when | Delivers |
|---|---|---|
| **M1 Service skeleton** | Phase 0 done | A runnable service, the health check and a test harness |
| **M2 Core API (MVP)** | Phases 1–2 done | Validated create, read, list, balance and status rules |
| **M3 Feature complete** | Phases 3–4 done | Filtering and summary |
| **M4 Release candidate** | Phases 5–7 done | A tested, documented, runnable product |

---

## 8. Dependencies between features

```
Phase 0 Foundation (health check, test harness)
   └─► Phase 1 Transaction recording + validation
          ├─► Phase 2 Balance + status rules
          │      └─► Phase 4 Summary
          └─► Phase 3 Filtering
                 (Phases 2–4 all feed both of the following)
                 ├─► Phase 5 Regression testing + coverage gate ─┐
                 └─► Phase 6 Sample data & tooling ──────────────┴─► Phase 7 Documentation
```
- Phases 2 and 3 are independent of each other and can run in parallel after Phase 1.
- Phases 5 and 6 are independent of each other and can run in parallel after Phases 1–4.
- No open product question blocks any phase.

---

## 9. Decisions and open questions

### 9.1 Decision log
| ID | Was | Decision | Rationale |
|---|---|---|---|
| **D1** | OQ1 | The client **may** supply the transaction timestamp (valid ISO 8601 with a timezone, not in the future). If it is left out, the system uses the current time. | The specification marks only the identifier as auto-generated. Its date-range example uses January 2024, which can only return data if historical timestamps are possible. Rejecting future dates prevents transactions being recorded as happening later. |
| **D2** | OQ2, OQ3 | Keep the funds check: a withdrawal or transfer without enough funds in that currency **at its timestamp** (and, if backdated, at every later point) is **recorded as `failed`** with a "created" outcome and the reason `INSUFFICIENT_FUNDS`. Deposits are always `completed`. `pending` is not assigned. Balances and summary totals use completed transactions only. The specification's sample requests are run in the documented flow, where the sample data first funds ACC-12345. | This gives the `status` field real meaning and keeps an audit trail of failed attempts. The request is valid, so an "invalid request" outcome would be misleading. Funding the account first keeps the samples successful without dropping a realistic rule. Processing is immediate, so nothing is ever pending. Revised 2026-11-22: funds were first checked at processing time, which let a backdated withdrawal spend money that arrived later; checking at the timestamp keeps every point of the history consistent. |
| **D3** | OQ4 | Balances and summary totals are reported **per currency**. | There is no currency conversion. One combined number would add, for example, dollars to euros, which is meaningless. |
| **D4** | OQ5 | An account with no transactions returns an **empty** balance or summary, not "not found". | Accounts have no registry; any well-formed identifier is a valid account that simply has no activity yet. "Not found" would wrongly suggest the account cannot exist. |
| **D5** | — | Each phase ships with its own automated tests. Phase 5 adds regression and edge cases. Milestones M1–M4 as in Section 7.1. | Defects surface in the phase that creates them, and every milestone is demonstrably working. |
| **D6** | OQ20 | Validation is delivered with transaction creation (Phase 1), before balance and status rules (Phase 2). | Removes the ordering risk: balances and the funds check never process invalid amounts, currencies or accounts. |
| **D7** | OQ19 | Coverage of at least 80% of lines and branches. Measured from Phase 0; a Definition-of-Done gate from Phase 5. | A common, achievable quality gate for a small service. It guarantees that error paths are tested, not only success paths. |
| **D8** | OQ17 | Include a health check. | Cheap. It lets the run script and developers confirm the service is up, and it is used in Phases 0 and 6. |
| **D9** | OQ21 | Target users as stated in Section 4. | Matches the product's nature: a developer-facing API with no end-user interface. |
| **D10** | OQ6 | The transaction list is sorted by timestamp, newest first. No pagination. | This is how banking history is usually shown. With client timestamps (D1), creation order and time order can differ. Data is in memory and volumes are small. |
| **D11** | OQ7 | The maximum amount of a single transaction is **1,000,000,000.00**. | A round, easy-to-document business limit. It keeps every balance and total exactly calculable at the scale of an in-memory service (see AD-5 in the Technical Implementation Plan). |
| **D12** | OQ8 | The account filter value is format-checked. A malformed value gives "invalid request". | Consistent with validation elsewhere. The client sees their mistake instead of an empty list. |
| **D13** | OQ9 | A transaction identifier in an unexpected format gives "not found". | Clients don't need to know the internal identifier format, and this is simpler. |
| **D14** | OQ10 | Account identifiers are case-insensitive and normalised to upper case (revised 2026-11-22; first decided as case-sensitive). | Two spellings of one identifier, such as `acc-ab12c` and `ACC-AB12C`, naming two different accounts would be a trap for clients. Upper case is the form the specification uses. |
| **D15** | OQ11 | Add a filter by status. | Failed transactions (D2) appear in the general list; this lets clients find them. This is an approved addition beyond the specification. |
| **D16** | OQ12 | Strict validation: unknown fields, unknown or repeated filter parameters, and amounts given as text are rejected. | A typo such as `?tpye=transfer` can't silently produce a wrong result. |
| **D17** | OQ13 | The per-currency decimal limit is deferred as a future enhancement and documented as a known limitation. | The specification ("maximum 2 decimal places") takes precedence, but the real-world gap (e.g. `JPY 100.5`) stays visible. |
| **D18** | OQ14 | Every currency in active circulation in ISO 4217, in upper case (revised 2026-11-22; first decided as a short list of 14 popular codes). Any other value gets "Invalid currency code". | The specification asks to "only accept valid ISO 4217 currency codes"; a short list rejected real codes such as `INR`. Historic and special codes (`XAU`, `XXX`, `XTS`) aren't real money for transactions. Upper case is the ISO standard form. |
| **D19** | OQ15 | The transaction count includes all transactions. The summary also reports how many failed. The most recent date considers all transactions. | Matches the specification and loses no information. |
| **D20** | OQ16 | In the summary, an incoming transfer counts as a deposit and an outgoing transfer as a withdrawal. | For each currency, deposits minus withdrawals equals the balance, which is easy to verify. |
| **D21** | OQ18 | Date filters accept full date-times (with a timezone) or dates only; dates only are UTC. A date-only "to" includes the whole day. | "Up to 31 January" intuitively includes the 31st. The specification's example works as expected. |
| **D22** | Original-plan proposals | All remaining original-plan rules are accepted as written. See the list below this table. | They don't conflict with the specification, and they make behaviour predictable for API clients. |

**Rules accepted under D22:**
- FR-1.6: which account fields each type requires or forbids, and a transfer's two accounts must differ.
- FR-1.8: invalid requests are not stored.
- Transactions cannot be changed after creation (Section 3.2).
- FR-4.2: the account identifier is also checked in balance and summary requests.
- FR-4.6: all validation problems are reported together.
- FR-5.1: the account filter matches the source or the destination.
- FR-5.4: combined filters must all match.
- FR-7.2: unknown route gives "not found", malformed content gives "invalid request", unexpected failures give a generic server error.

### 9.2 Open questions and proposals
None. All product behaviour is decided. Technical decisions are listed in 9.3.

### 9.3 Technical decisions referenced, to be made in the Technical Implementation Plan [Tech]
These are **not resolved here**. They are listed so they are not lost.
- Technology stack and runtime, and how the port is configured.
- How in-memory storage is organised, and how it is reset between tests.
- Identifier generation.
- How money amounts are represented internally, to avoid rounding errors.
- The source of the list of active currency codes (D18).
- Sorting rule for transactions with identical timestamps (D10).
- How timestamps are parsed and compared, including what counts as "in the future".
- Exact request and response formats, error formats and status codes (the API contracts).
- Error-handling mechanism.
- Test tooling, test structure, and how coverage is measured and enforced.
- Format and tooling for the run script, sample requests and sample data loading.
- Project structure.
