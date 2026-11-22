# 🏦 Homework 1: Banking Transactions API

> **Student Name**: [Your Name]
> **Date Submitted**: [Date]
> **AI Tools Used**: [List tools, e.g., Claude Code, GitHub Copilot]

---

## 📋 Project Overview

A REST API for simple banking transactions, built with Node.js and Express 5. Clients record deposits, withdrawals and transfers between accounts, list and filter the transaction history, and read per-currency balances and an account summary. Data is held in memory, as the task requires.

Implemented tasks from [TASKS.md](TASKS.md):

| Task | Status |
|---|---|
| Task 1: Core API (create, list, get by id, balance) | ✅ |
| Task 2: Transaction validation | ✅ |
| Task 3: Transaction history filtering | ✅ |
| Task 4, Option A: Transaction summary endpoint | ✅ |

How to install, run, test and try the API: [HOWTORUN.md](HOWTORUN.md). The detailed plans are in [docs/](docs/): [product plan](docs/product-execution-plan.md) (requirements FR-x, and product decisions D1–D22 with their rationale in section 9.1) and [technical plan](docs/technical-implementation-plan.md) (architecture decisions AD-x).

> **The sample transfer on an empty system fails.** The task's sample request transfers 100.50 USD from ACC-12345. On a fresh server with no data, ACC-12345 has no money, so the transfer is recorded as `failed` with `INSUFFICIENT_FUNDS` (D2). Start with `demo/run.sh`, which loads sample data that funds ACC-12345 first; the transfer then completes. See [HOWTORUN.md](HOWTORUN.md).

## ✨ Features

- **Transactions:** create a deposit, withdrawal or transfer; list all transactions newest first; get one by id.
- **Validation:** amount (positive JSON number, at most 2 decimal places, at most 1,000,000,000), account format `ACC-XXXXX` (any case, stored in upper case), active ISO 4217 currency, type, which account fields each type needs, optional timestamp. Every problem in a request is reported at once.
- **Funds check:** a withdrawal or transfer without enough money in that currency at its own timestamp is still recorded, with `status: "failed"` and `failureReason: "INSUFFICIENT_FUNDS"`. A backdated one must also leave every later balance non-negative.
- **Balance:** per currency, from completed transactions only.
- **Filtering:** by account (source or destination), type, status and date range, combinable.
- **Summary:** per-currency deposits and withdrawals, transaction count, failed count, most recent transaction date.
- **Health check:** `GET /health`.
- **Demo tooling:** `demo/run.sh` starts the API and loads sample data; `demo/sample-requests.http` has 24 ready-made requests; a Postman collection with tests is in `postman/`.
- **Tests:** 461 Jest + supertest tests, 100% line and branch coverage (the gate is 80%). A traceability test checks that every requirement and decision in the plans is covered by a test named after it.

## 🏗️ Architecture

A layered, single-process service. Dependencies point one way: routes → validators / services → store. Services never import Express, so they are tested without HTTP.

```
homework-1/
├── src/
│   ├── server.js                 # the only file that listens on a port
│   ├── app.js                    # Express app: JSON parser, routes, 404, error handler
│   ├── config.js                 # the only module that reads process.env (PORT, NODE_ENV)
│   ├── routes/                   # health, transactions, accounts: HTTP only
│   ├── validators/               # pure functions returning a list of {field, message}
│   ├── services/                 # transactionService (create, funds rule, filter, sort),
│   │                             # accountService (balance, summary)
│   ├── store/transactionStore.js # in-memory array + Map by id; no update or delete
│   ├── middleware/               # request logger, 404, error handler
│   ├── errors/                   # ValidationError (400), NotFoundError (404)
│   └── utils/                    # money, dates, constants
├── tests/                        # unit/, integration/, traceability.test.js
├── demo/                         # run.sh, seed.js, sample-data.json, sample-requests.http
├── postman/                      # collection + local environment
└── docs/                         # product and technical plans, screenshots
```

Architecture decisions (details in the [technical plan](docs/technical-implementation-plan.md), section 14):

| ID | Decision | Why |
|---|---|---|
| AD-1 | Plain JavaScript (CommonJS), no TypeScript | Small codebase, no build step |
| AD-2 | Express 5 | Current stable line; async errors reach the error handler; the simple query parser never builds nested objects |
| AD-3 | In-memory repository: an array plus a `Map` by id | Required by the task; O(1) lookup by id; storage is isolated behind one module |
| AD-4 | Money as integer hundredths | Avoids floating-point errors: `0.1 + 0.2` gives exactly `0.3` |
| AD-5 | Maximum amount 1,000,000,000 | Keeps every sum exact with plain numbers |
| AD-6 | Strict ISO 8601 timestamps with a timezone | `Date.parse` accepts non-ISO text and silently rolls `2024-02-30` forward |
| AD-7 | Every active ISO 4217 currency, as a list in the code | What the task asks for; no dependency, and withdrawn or special codes (e.g. `XAU`, `XTS`) are not money an account can hold |
| AD-8 | Balances derived from transactions on every request; deterministic ordering | One source of truth, nothing to drift |
| AD-9 | Jest + supertest | Tests the app without opening a port |
| AD-10 | ESLint (flat config) + Prettier | Consistent style, checked by `npm run lint` and `npm run format:check` |

## 📖 API reference

All requests and responses are JSON. Amounts are JSON numbers in major units (`100.5`); timestamps in responses are UTC with milliseconds (`2024-01-15T10:30:00.000Z`).

| Method | Path | Success | Errors |
|---|---|---|---|
| `GET` | `/health` | 200 `{"status":"ok"}` | — |
| `POST` | `/transactions` | 201 + `Location` header, the transaction | 400, 413, 415 |
| `GET` | `/transactions` | 200, array (possibly empty) | 400 (invalid filter) |
| `GET` | `/transactions/:id` | 200, the transaction | 404 |
| `GET` | `/accounts/:accountId/balance` | 200 | 400 |
| `GET` | `/accounts/:accountId/summary` | 200 | 400 |

Any other route or method gives 404 `{"error":"Not found"}`.

### `POST /transactions`

```json
{
  "fromAccount": "ACC-12345",
  "toAccount": "ACC-67890",
  "amount": 100.5,
  "currency": "USD",
  "type": "transfer",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

| Field | Rules |
|---|---|
| `type` | Required: `deposit`, `withdrawal` or `transfer` |
| `amount` | Required JSON number (not text), > 0, at most 2 decimal places, at most 1000000000 |
| `currency` | Required. An active ISO 4217 code, upper case |
| `fromAccount` | `ACC-` + 5 letters or digits, in any case; stored and returned in upper case, so `acc-ab12c` and `ACC-AB12C` are the same account. Required for withdrawal and transfer; must be absent or `null` for a deposit |
| `toAccount` | Same format. Required for deposit and transfer; must be absent or `null` for a withdrawal; must differ from `fromAccount` |
| `timestamp` | Optional. ISO 8601 with seconds and a timezone (`Z` or `+02:00`), not in the future |

Any other field is rejected; `id`, `status` and `failureReason` are set by the server.

**Currencies:** every currency in active circulation in ISO 4217 (155 codes, e.g. USD, EUR, GBP, JPY, INR, UAH). Withdrawn codes (`HRK`, `BGN`), fund codes (`BOV`), precious metals (`XAU`), `XDR` and the test codes `XTS` / `XXX` are rejected. The list is in `src/utils/constants.js`.

**201 Created** (`Location: /transactions/{id}`):

```json
{
  "id": "6f1c0c3e-3d3a-4f6e-9a57-2b0c3c1d9e11",
  "fromAccount": "ACC-12345",
  "toAccount": "ACC-67890",
  "amount": 100.5,
  "currency": "USD",
  "type": "transfer",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "status": "completed"
}
```

Without enough funds the response is still 201, with `"status": "failed"` and `"failureReason": "INSUFFICIENT_FUNDS"`. Funds are checked at the transaction's `timestamp`: a backdated withdrawal or transfer fails if the account did not hold enough at that moment, or if it would make any later balance negative. Both `fromAccount` and `toAccount` are always present in a response, `null` where the type doesn't use them.

### `GET /transactions` filters

| Parameter | Rule |
|---|---|
| `accountId` | `ACC-XXXXX`, any case; matches `fromAccount` **or** `toAccount` |
| `type` | `deposit`, `withdrawal` or `transfer` |
| `status` | `pending`, `completed` or `failed` |
| `from`, `to` | `YYYY-MM-DD` (UTC day) or a date-time with a timezone; both ends inclusive; `from` must not be later than `to` |

Filters combine with AND, and the result stays newest first. Each parameter may appear once; unknown, repeated or empty parameters give 400. In a URL, write a `+` offset as `%2B` (`2024-01-15T10:30:00%2B02:00`) or use `Z`.

```
GET /transactions?accountId=ACC-12345&type=transfer&from=2024-01-01&to=2024-01-31
```

### `GET /accounts/:accountId/balance`

After `demo/run.sh` and the sample transfer:

```json
{ "accountId": "ACC-12345", "balance": { "USD": 4699.51, "EUR": 950, "UAH": 1000 } }
```

A currency appears once the account has a completed transaction in it; a net zero shows as `0`. No transactions: `"balance": {}`. The path id is case-insensitive (`/accounts/acc-12345/balance` works too); the response gives it in upper case.

### `GET /accounts/:accountId/summary`

Same state; the most recent date is when the sample transfer was sent:

```json
{
  "accountId": "ACC-12345",
  "totalDeposits": { "USD": 5000, "EUR": 1200, "UAH": 1000 },
  "totalWithdrawals": { "USD": 300.49, "EUR": 250, "UAH": 0 },
  "transactionCount": 7,
  "failedCount": 1,
  "mostRecentTransactionDate": "2026-11-22T10:00:00.000Z"
}
```

No transactions: `{}`, `{}`, `0`, `0`, `null`.

### Errors

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "amount", "message": "Amount must be a positive number" },
    { "field": "currency", "message": "Invalid currency code. Use an active ISO 4217 code in upper case, e.g. USD, EUR or GBP" }
  ]
}
```

| Case | Status | Body |
|---|---|---|
| Invalid body, filter, `accountId` or query parameter | 400 | `{"error":"Validation failed","details":[…]}`, every problem listed |
| Malformed JSON, a body that is not a JSON object, or a missing / non-JSON `Content-Type` | 400 | `details` with `field: "body"` |
| Invalid percent-encoding in the URL path | 400 | `details` with `field: "path"` |
| Body larger than 100 kb | 413 | `details` with `field: "body"` |
| Unsupported charset or `Content-Encoding` | 415 | `details` with `field: "body"` |
| Unknown transaction | 404 | `{"error":"Transaction not found"}` |
| Unknown route or method | 404 | `{"error":"Not found"}` |
| Unexpected error | 500 | `{"error":"Internal server error"}`, no internals |

## ⚠️ Known limitations

- No authentication or authorization: anyone who can reach the port can create transactions and read every account.
- No rate limiting.
- Data is in memory and is lost when the server stops.
- Every currency accepts 2 decimal places, including JPY, which has none in practice (D17).
- A single transaction is limited to 1,000,000,000; account totals stay exact up to about 90 trillion.
- A timestamp even 1 ms ahead of the server clock is rejected as being in the future.
- The currency list is a constant in the code: when ISO 4217 adds or withdraws a currency, it needs a manual update.
- In date filters, `+` in an offset must be URL-encoded as `%2B` (or use `Z`); an unencoded `+` gives 400 with a hint.
- No pagination: the transaction list returns everything.
- Amounts are JSON numbers: `100.50` comes back as `100.5`, and numbers with more than 15–17 significant digits are rounded by the JSON parser before validation.

<div align="center">

*This project was completed as part of the AI-Assisted Development course.*

</div>
