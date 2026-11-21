# Technical Implementation Plan — Banking Transactions API

| | |
|---|---|
| **Document type** | Technical Implementation Plan (HOW we build it) |
| **Implements** | [product-execution-plan.md](product-execution-plan.md) — functional requirements FR-1 to FR-8, decisions D1–D22, phases 0–7 |
| **Requirements source** | [TASKS.md](../TASKS.md) |
| **Derived from** | Technical notes in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) |
| **Status** | Architecture reviewed. All details introduced here were reviewed and approved ([Section 16](#16-reviewed-details)). Updated after the plan review in [plan-review.md](plan-review.md). |

### Decision status labels
| Label | Meaning |
|---|---|
| **Confirmed** | Taken from the original technical notes or the product plan, or approved in review |
| **Proposed** | Introduced in this document, not yet reviewed. Applies unless rejected. |
| **Requires approval** | Must be decided before the affected task starts |
| **Open question** | Not decided |

References: **FR-x** = functional requirement, **Dx** = product decision, **ADx** = architecture decision in this document, **Tx.y** = implementation task.

---

## 1. Technology stack

| Layer | Choice | Status | Justification |
|---|---|---|---|
| Runtime | Node.js, `engines: >=22`; developed on 26 (LTS) | Confirmed | Both are LTS. The built-in `fetch`, `crypto.randomUUID()` and `--watch` remove the need for dependencies. |
| Language | JavaScript, CommonJS, no TypeScript | Confirmed | Small codebase, no build step. See AD-1. |
| Web framework | Express 5 | Confirmed | See AD-2. |
| Storage | In-memory, behind a repository module | Confirmed | Required by the specification. See AD-3. |
| Test runner | Jest, with supertest for HTTP | Confirmed | See AD-9. |
| Lint and format | ESLint (flat config) + Prettier | Confirmed | See AD-10. |
| Dev reload | `node --watch` | Confirmed | Replaces nodemon from the original notes, so there is one fewer dependency. |
| Runtime dependencies | `express` only | Confirmed | Minimal supply-chain surface. |
| Dev dependencies | `jest`, `supertest`, `eslint`, `@eslint/js`, `globals`, `eslint-config-prettier`, `prettier` | Confirmed | Tooling only, never shipped to runtime. |

---

## 2. High-level system architecture

```
HTTP client (curl, REST Client, tests, other services)
        │  JSON over HTTP/1.1
        ▼
┌──────────────────────────── Express 5 app (src/app.js) ────────────────────────────┐
│  express.json (100 kb, objects/arrays only) → requestLogger                         │
│                                                                                     │
│  routes/health.js        routes/transactions.js        routes/accounts.js           │
│        │                       │                              │                     │
│        │               validators/* (pure, collect ALL errors → ValidationError)    │
│        │                       │                              │                     │
│        │               services/transactionService     services/accountService      │
│        │               (create, funds rule, filter,    (balance, summary)           │
│        │                sort)                                 │                     │
│        │                       └──────────────┬───────────────┘                     │
│        │                                      ▼                                     │
│        │                       store/transactionStore (in-memory repository)        │
│                                                                                     │
│  notFound (404 catch-all) → errorHandler (400 / 404 / 500, logs 500s)               │
└─────────────────────────────────────────────────────────────────────────────────────┘
src/server.js — the only file that calls app.listen(PORT); tests import app.js directly
```

**Request flow, for example `POST /transactions`:**
1. Express parses the JSON body.
2. The route calls the validator, which returns the list of every error at once. If the list is not empty, the route throws `ValidationError(details)`, giving a 400.
3. The service:
   - sets the default timestamp;
   - calculates the source account's balance in that currency from the store;
   - decides `completed` or `failed`;
   - saves the transaction.
4. The route returns 201 with the public representation of the transaction.

**Architectural style:** a layered monolith in a single process. Dependencies point one way only: routes → validators/services → store. Services never import Express, so they can be tested without HTTP.

---

## 3. Frontend and backend architecture

- **Frontend:** not applicable. The product has no user interface (product plan §3.2). Confirmed.
- **Backend:** see §2 and §4. Each layer has one responsibility:

| Layer | Responsibility | Must not |
|---|---|---|
| Routes | Map HTTP to service calls; choose status codes; shape responses | Contain business rules |
| Validators | Pure functions: input → list of `{field, message}` | Read the store (exception: none needed) |
| Services | Business rules: status and funds, balance, summary, filtering, sorting | Know about `req`/`res` |
| Store | Hold and return transaction records | Contain business rules |
| Middleware | Cross-cutting concerns: logging, 404, error formatting | — |

---

## 4. Project structure and module responsibilities

```
homework-1/
├── package.json, package-lock.json       # scripts, engines, deps; lockfile committed
├── .gitignore                            # node_modules/, coverage/, .env, logs
├── eslint.config.js, .prettierrc, .prettierignore
├── jest.config.js                        # coverage thresholds (D7)
├── src/
│   ├── app.js                    # builds the Express app; no listen()
│   ├── server.js                 # app.listen(config.port)
│   ├── config.js                 # reads PORT (default 3000), NODE_ENV
│   ├── routes/
│   │   ├── health.js             # GET /health
│   │   ├── transactions.js       # POST /transactions, GET /transactions, GET /transactions/:id
│   │   └── accounts.js           # GET /accounts/:accountId/balance, /summary
│   ├── validators/
│   │   ├── transactionValidator.js   # body rules (FR-1.6, FR-4, D1, D14, D16, D18)
│   │   ├── queryValidator.js         # filter params (FR-5.5, FR-5.6, D12, D16, D21)
│   │   └── accountIdValidator.js     # path :accountId (FR-4.2)
│   ├── services/
│   │   ├── transactionService.js     # create (D1 default timestamp, D2 funds rule), list/filter/sort (D10, FR-5)
│   │   └── accountService.js         # balance (FR-3, D3, D4), summary (FR-6, D19, D20)
│   ├── store/
│   │   └── transactionStore.js       # add, getAll, getById, reset (tests only)
│   ├── middleware/
│   │   ├── requestLogger.js
│   │   ├── notFound.js
│   │   └── errorHandler.js
│   ├── errors/
│   │   ├── ValidationError.js        # carries details[]
│   │   └── NotFoundError.js
│   ├── utils/
│   │   ├── money.js                  # decimal check, toMinor/fromMinor, MAX_AMOUNT (AD-4, AD-5)
│   │   ├── dates.js                  # strict ISO parse, future check, UTC day bounds (AD-6)
│   │   └── constants.js              # TYPES, STATUSES, FAILURE_REASONS, ACCOUNT_REGEX, ALLOWED_FIELDS, CURRENCIES (AD-7)
├── tests/
│   ├── unit/        (money, dates, validators, services)
│   ├── integration/ (health, transactions, validation, filters, balance, summary, errors)
│   └── helpers/     (request builders, seeding helpers)
├── demo/
│   ├── run.sh                    # install if needed, start server, wait for /health, seed (skip with --no-seed)
│   ├── seed.js                   # POST sample-data.json in order (Node fetch; no jq)
│   ├── sample-data.json
│   └── sample-requests.http      # REST Client, UF-2 order, incl. error cases
├── docs/ (product and technical plans)
├── README.md, HOWTORUN.md
```
Status: Confirmed (based on the structure in the original notes). New files are `config.js`, `errors/`, `utils/money.js`, `utils/dates.js`, `queryValidator.js`, `accountIdValidator.js`, `health.js`, `requestLogger.js`, `notFound.js`, `seed.js`, and the lint/format/Jest configs. They come from AD-2 to AD-10.

---

## 5. Data design

### 5.1 Storage
There is no database: this is in-memory storage (specification, Confirmed). Data is lost on restart (product plan §3.2).

### 5.2 Entities and relationships
```
Transaction (stored)                         Account (derived, never stored)
───────────────────────────                  ─────────────────────────────
id            UUID v4 (string)               accountId  "ACC-XXXXX"
fromAccount   accountId | null   ──┐         = any identifier appearing in
toAccount     accountId | null   ──┼──────►    fromAccount or toAccount
amountMinor   integer (hundredths)│
currency      ISO 4217 code       │         Relationship: Transaction 0..1 → source Account
type          deposit|withdrawal|transfer   Transaction 0..1 → destination Account
timestamp     ISO 8601 UTC string           deposit: to only · withdrawal: from only ·
status        completed|failed              transfer: both (different)
failureReason "INSUFFICIENT_FUNDS" | absent
seq           integer (internal, creation order)
```
- **Store internals** (Confirmed): an array in insertion order plus a `Map` from `id` to record, so lookup by ID is O(1). `seq` is a counter that increases on every insert and breaks timestamp ties (AD-8). It is never exposed.
- **Public representation** (Confirmed, apart from the null-field detail in §16): `amount` in major units as a JSON number (`100.5`); `seq` and `amountMinor` hidden; `failureReason` only on failed transactions.
- **Immutability** (Confirmed, D22): the store has no update or delete operations. `reset()` exists only for tests and is not reachable over HTTP.

---

## 6. API contracts and communication

**Communication pattern:**
- Synchronous request/response, JSON over HTTP. No messaging, no async jobs, no webhooks (Confirmed).
- `Content-Type: application/json` on all responses.
- All amounts are JSON numbers in major units. All timestamps are ISO 8601 UTC strings with milliseconds (`2024-01-15T10:30:00.000Z`).

### 6.1 `POST /transactions` — FR-1, FR-4, D1, D2, D16
Request body. Only these fields are allowed; anything else gives 400 (D16):
```json
{ "fromAccount": "ACC-12345", "toAccount": "ACC-67890", "amount": 100.50,
  "currency": "USD", "type": "transfer", "timestamp": "2024-01-15T10:30:00Z" }
```
| Field | Rule |
|---|---|
| `type` | Required. One of `deposit`, `withdrawal`, `transfer`. |
| `fromAccount` / `toAccount` | `^ACC-[A-Za-z0-9]{5}$` (case-sensitive, D14). Required, forbidden or must-differ depending on the type (FR-1.6). |
| `amount` | A JSON number, not text. Finite, > 0, ≤ 2 decimals, ≤ `MAX_AMOUNT` (AD-4, AD-5). |
| `currency` | Required. One of the supported ISO 4217 codes, upper case (D18, AD-7). Otherwise the message is `Unsupported currency code. Supported: USD, EUR, …`. |
| `timestamp` | Optional. Strict ISO 8601 date-time with an offset, a real calendar date, not in the future (D1, AD-6). |
| `id`, `status`, `failureReason` | Not accepted. Unknown field gives 400 (FR-1.2, FR-1.4, D16). |

Responses:
- `201 Created`: the transaction.
  - Completed:
    ```json
    { "id": "…uuid…", "fromAccount": "ACC-12345", "toAccount": "ACC-67890", "amount": 100.5,
      "currency": "USD", "type": "transfer", "timestamp": "2024-01-15T10:30:00.000Z", "status": "completed" }
    ```
  - Failed, for insufficient funds (D2; `failureReason` approved in review):
    ```json
    { "...": "...", "status": "failed", "failureReason": "INSUFFICIENT_FUNDS" }
    ```
- `400`: validation error (§6.7).

### 6.2 `GET /transactions` — FR-2, FR-5, D10, D12, D15, D16, D21
| Query param | Rule |
|---|---|
| `accountId` | `ACC-XXXXX` format. Matches `fromAccount` **or** `toAccount`. |
| `type` | One of the three types |
| `status` | `pending`, `completed` or `failed` |
| `from`, `to` | `YYYY-MM-DD` (UTC; `to` extends to `23:59:59.999Z`) or a full ISO 8601 date-time. `from ≤ to`. |

Rules:
- Each parameter must appear at most once. Repeated parameters, unknown parameters and empty values give 400.
- All filters combine with AND.
- The result is always sorted by `timestamp` descending, then `seq` descending.
- `200` returns a JSON array, possibly empty.

### 6.3 `GET /transactions/:id` — FR-2.2, D13
`200` returns the transaction. An unknown or badly formatted ID returns `404 {"error":"Transaction not found"}`.

### 6.4 `GET /accounts/:accountId/balance` — FR-3, D3, D4
- `200 {"accountId":"ACC-12345","balance":{"USD":100.5,"EUR":0}}`.
  - The balance counts completed transactions only.
  - A currency is listed if the account has any completed transaction in it. A net zero shows as `0`.
  - No completed transactions gives `{}`.
- A malformed `accountId` gives `400`.

### 6.5 `GET /accounts/:accountId/summary` — FR-6, D3, D4, D19, D20
```json
{ "accountId": "ACC-12345",
  "totalDeposits":    { "USD": 1000 },
  "totalWithdrawals": { "USD": 250.5 },
  "transactionCount": 5,
  "failedCount": 1,
  "mostRecentTransactionDate": "2024-01-31T12:00:00.000Z" }
```
- **Totals:** completed transactions only. An incoming transfer counts as a deposit and an outgoing one as a withdrawal. Invariant: for each currency, deposits − withdrawals = balance.
- **Currency keys:** `totalDeposits` and `totalWithdrawals` always have the same keys as the balance, with `0` for a side without movement. For example, an account with only USD deposits gives `totalWithdrawals: {"USD": 0}` (FR-6.3).
- **Counts:** `transactionCount` covers all of the account's transactions. `failedCount` covers the failed ones.
- **Date:** `mostRecentTransactionDate` is the newest timestamp across all of the account's transactions.
- **Empty account:** `{}`, `{}`, `0`, `0`, `null`.
- **Errors:** a malformed `accountId` gives `400`.

### 6.6 `GET /health` — FR-8.1, D8
`200 {"status":"ok"}`

### 6.7 Error contract — FR-4.6, FR-7 (Confirmed, from the original notes)
| Case | Status | Body |
|---|---|---|
| Validation failure, invalid query, malformed `accountId` | 400 | `{"error":"Validation failed","details":[{"field":"amount","message":"Amount must be a positive number"}, …]}` |
| Invalid JSON, a body that isn't a JSON object, or a missing / non-JSON `Content-Type` | 400 | `{"error":"Validation failed","details":[{"field":"body","message":"Request body must be a JSON object"}]}` (invalid JSON: `"Malformed JSON"`) |
| JSON body larger than the 100 kb limit | 413 | `{"error":"Validation failed","details":[{"field":"body","message":"Request body must not exceed 100kb"}]}` |
| Unknown transaction | 404 | `{"error":"Transaction not found"}` |
| Unknown route or method | 404 | `{"error":"Not found"}` |
| Unexpected error | 500 | `{"error":"Internal server error"}`, with no stack trace or internals |

`details` lists **every** problem, in field order. Messages are human-readable English. The exact wording is set in the validator and covered by tests.

---

## 7. Third-party integrations
None. There are no external APIs, payment providers, FX rate services, email or identity providers (Confirmed). The currency list is a constant in the code, not a service (AD-7).

## 8. Authentication and authorization
None, as a product non-goal (Confirmed). Consequences and future path:
- Anyone who can reach the port can create transactions and read every account. This is documented as a known limitation in the README.
- **Extension point:** an auth middleware mounted in `app.js` before the routers. Services take plain arguments, so adding a caller identity later doesn't change their signatures beyond an optional context.

## 9. Security considerations

| Concern | Measure | Status |
|---|---|---|
| Malformed or oversized input | `express.json({ limit: '100kb' })` (a larger body gives 413, §6.7); strict validation of every field and query parameter (D16) | Confirmed |
| Prototype pollution | Unknown fields are rejected, so `__proto__` and `constructor` in a body or query give 400. Query parser is Express 5 `simple`, which creates no nested objects. | Confirmed |
| Information leakage | 500 responses are generic; stacks are only logged. `x-powered-by` is disabled. | Confirmed |
| Injection | No database, shell or template rendering. Values are only compared and stored. | Confirmed |
| Cross-origin access | No CORS headers, so browsers on other origins are blocked | Confirmed |
| Security headers (`helmet`) | Not added; the service returns JSON only | Confirmed |
| Abuse and DoS | No rate limiting (Option D not selected). The body limit and O(n) operations are the only safeguards. | Confirmed (documented risk) |
| Supply chain | One runtime dependency. Lockfile committed. | Confirmed |
| Secrets | None exist. `.env` is gitignored anyway. | Confirmed |

## 10. Error handling and logging

### 10.1 Error handling (Confirmed)
- **Domain errors:** `ValidationError(details[])` gives 400 and `NotFoundError(message)` gives 404. Both are thrown by routes: validators stay pure and only return `details`.
- **JSON parse errors:** Express's `SyntaxError` with `type === 'entity.parse.failed'` is mapped to 400 in the same format.
- **Oversized body:** Express's error with `type === 'entity.too.large'` is mapped to 413 in the same format, with the limit taken from `config.bodyLimit`. Without this mapping it would fall through to a 500.
- **Unknown errors:** 500 with a generic body, and logged with the stack trace.
- **Unknown routes:** `notFound` is the last router and gives 404 `{"error":"Not found"}`.
- **Async handlers:** Express 5 forwards rejected promises to the error handler (AD-2). Handlers are synchronous today anyway.

### 10.2 Logging (Confirmed)
- **Request log:** `requestLogger` writes one line per request to stdout when the response finishes: `METHOD path status durationMs`.
- **Error log:** 500 errors go to stderr with method, path and stack trace.
- **Under tests:** nothing is logged when `NODE_ENV=test`, which keeps test output clean.
- **What is never logged:** request bodies, which keeps amounts and accounts out of logs.
- **Future:** move to `pino` for structured JSON logs if the service is ever deployed.

---

## 11. Testing and quality strategy (D5, D7)

| Level | Scope | Tooling |
|---|---|---|
| Unit | `money.js` (decimal and precision edges, max), `dates.js` (ISO strictness, day bounds, future), validators (every rule plus collect-all), services (funds rule, balance, summary invariant, filter and sort) | Jest |
| Integration | Every endpoint through HTTP: status codes, body shapes, error contract, the TASKS.md sample flow (UF-2) | Jest + supertest on `app.js` (no port) |
| Static | Lint and format checks | ESLint, Prettier |
| Manual | `demo/sample-requests.*` against a running server (Phase 6) | curl / REST Client |

**Rules:**
- **Isolation:** `transactionStore.reset()` runs in `beforeEach`. No test depends on another test's data.
- **Traceability:** every test name starts with the FR, D or AD ID it verifies, for example `it('FR-4.1 rejects more than 2 decimal places')`. `npx jest -t FR-4.1` then shows the tests for one requirement, which makes the Phase 5 "every FR is covered" criterion checkable.
- **Per-phase testing:** each phase adds its tests, and the whole suite must pass before the phase is done (D5).
- **Coverage gate:** at least 80% lines and branches globally (D7), set in `jest.config.js` `coverageThreshold`. `npm run test:coverage` fails below it.
- **Edge-case catalogue (Phase 5):**
  - client-sent `id`, `status` or `failureReason`;
  - future, offset-less or impossible timestamps;
  - forbidden account fields for a type;
  - same account on both sides of a transfer;
  - insufficient funds in the same currency, and other currencies not counting;
  - `0.1 + 0.2` style amounts;
  - `1.15` (a float trap in multiplication);
  - `1e-7`;
  - `"100"` as text;
  - `100.123`;
  - `1000000000` (accepted) and `1000000000.01` (rejected);
  - lower-case `acc-` and `usd`;
  - unsupported currency codes (for example `XXX`, `ABC`);
  - repeated, unknown or empty query parameters;
  - `from > to`;
  - a date-only `to` including 23:59:59.999;
  - sorting of equal timestamps;
  - empty account balance and summary;
  - the deposits − withdrawals = balance invariant;
  - malformed JSON;
  - a non-object body;
  - an unknown route;
  - a missing or non-JSON `Content-Type`;
  - an unencoded `+` offset in a date filter;
  - summary currency keys for one-sided activity (zero-fill).
- **npm scripts:**
  - `test`: Jest;
  - `test:coverage`: Jest with `--coverage`;
  - `lint` / `lint:fix`;
  - `format` / `format:check`;
  - `start`;
  - `dev`: `node --watch src/server.js`.

## 12. Infrastructure and environments

| Environment | Purpose | Configuration |
|---|---|---|
| Local development | `npm run dev` or `demo/run.sh` | `PORT` (default `3000`), `NODE_ENV=development` |
| Test | Jest, in process, no port | `NODE_ENV=test` (set by Jest), logging off |
| Staging / production | **None.** There is no deployment target in scope. | — |

- No Docker image (Confirmed). It is an easy later addition, because the app reads its configuration only from environment variables.
- `config.js` is the only module that reads `process.env`.

## 13. CI/CD and deployment strategy

- **CI:** none (Confirmed). It is not required by the homework, and a workflow would have to live in `.github/` at the repository root, outside `homework-1/`. Upstream also deliberately removed its workflows in commit `1370fd6`.
- **Quality checks are run locally** before opening the pull request:
  1. `npm run lint`;
  2. `npm run format:check`;
  3. `npm run test:coverage` (fails below the threshold).
- **CD:** none. There is nothing to deploy.

---

## 14. Architecture decisions

### AD-1 Plain JavaScript (CommonJS), no TypeScript — Confirmed
- **Why:** a small service whose priority is fast iteration and no build step.
- **Alternatives:** TypeScript, or ESM JavaScript.
- **Trade-offs:** no compile-time types. JSDoc on public functions and the tests make up for it.
- **Risks:** type errors surface only at runtime. Mitigated by strict validation at the edge and coverage ≥ 80%.

### AD-2 Express 5 — Confirmed
- **Why:**
  - it is the current stable line;
  - rejected promises go to the error handler automatically;
  - the default `simple` query parser makes repeated parameters arrays (easy to reject, D16) and never creates nested objects.
- **Alternatives:** Express 4 (as in the original notes); Fastify (built-in schema validation, faster); Node `http` (no dependency).
- **Trade-offs:** fewer online examples use Express 5 syntax. Fastify would move validation into JSON Schema, which suits the requirement for custom error messages listing all problems less well.
- **Risks:** subtle changes in v5 behaviour. In particular, `req.body` is `undefined` when no body was parsed (no body, or a `Content-Type` other than `application/json`). The validator treats this as a non-object body and returns 400 with `field: "body"` (§6.7).

### AD-3 In-memory repository with an array plus a Map — Confirmed
- **Why:** required by the specification. The repository interface isolates storage from the services.
- **Alternatives:** a plain array only (O(n) lookup by ID); SQLite in memory (needs a dependency and schema).
- **Trade-offs:** the data is volatile.
- **Risks:** memory grows without limit during long runs. Acceptable for this scope, and documented.

### AD-4 Money as integer hundredths — Confirmed
- **Why:** avoids binary floating-point errors (`0.1 + 0.2 ≠ 0.3`). Every currency allows at most 2 decimals (FR-4.1, D17), so hundredths work for all of them. This replaces the per-currency `Intl` minor units in the original notes, which are no longer needed.
- **How the decimal check works:**
  - `amount` must be a finite JSON number.
  - Its text form must match `^\d+(\.\d{1,2})?$`, which also rejects exponent forms such as `1e-7`.
  - The conversion is `Math.round(amount * 100)`, applied only **after** the check passes.
  - Output is `minor / 100`.
- **Alternatives:** a decimal library such as `decimal.js` (adds a dependency); `BigInt` for everything (awkward JSON handling); floats with rounding (error-prone).
- **Trade-offs:** a client sending `100.50` gets `100.5` back. This is a JSON number property and will be documented.
- **Risks:** inputs with more than 15–17 significant digits are rounded by the JSON parser before validation. This is a client-side precision limit, documented.

### AD-5 Maximum amount — Confirmed (D11)
- **What:** `MAX_AMOUNT = 1_000_000_000` (in hundredths: `100_000_000_000`). One extra check in the validator.
- **Why:**
  - Balance and summary totals are added up as plain integer hundredths (regular `Number`), then divided by 100 for output. No `BigInt`.
  - Integer sums are exact up to `Number.MAX_SAFE_INTEGER` (about 9 × 10¹⁵ hundredths, i.e. about 90 trillion). With a 1 billion cap, that is about 90,000 maximum-size transactions in one account and currency, far beyond any in-memory use.
  - A round limit keeps the boundary tests clean: `1000000000` and `1000000000.01` are both exactly representable as text and convert to hundredths without float artefacts. The earlier limit of `MAX_SAFE_INTEGER / 100` sat where doubles are spaced about 0.016 apart, which made the boundary tests fragile.
- **Alternatives:** `MAX_SAFE_INTEGER / 100` with `BigInt` sums (exact, but extra conversion code for no practical benefit); no limit.
- **Trade-offs:** a single transaction above one billion is rejected, even though it would be representable.
- **Risks:** totals above about 90 trillion would lose precision. Unrealistic at in-memory scale; documented as a known limitation.

### AD-6 Strict timestamps — Confirmed (D1, D21)
- **Why:** `Date.parse` accepts non-ISO input and normalises impossible dates.
- **Body `timestamp`:**
  - It must match ISO 8601 date-time **with an offset** (`Z` or `±hh:mm`).
  - It must round-trip as a real date, so `2024-02-30` is rejected.
  - It must not be later than the server clock, with zero tolerance.
  - It is stored as `toISOString()` (UTC).
- **Filters:** `YYYY-MM-DD` means the start or end of that day in UTC. Full date-times follow the same rules as the body.
- **`+` in query strings:** in a URL query, an unencoded `+` decodes to a space, so `?from=2024-01-15T10:30:00+02:00` arrives as `…10:30:00 02:00`. This is rejected with the message `Invalid date. Encode "+" in an offset as %2B, or use Z`. The API reference documents `%2B` and recommends `Z` or date-only values. A test covers both the encoded and unencoded forms.
- **Approved in review:** requiring a timezone (formerly R2) is now part of D1 and D21 in the product plan.
- **Alternatives:** accept any value `Date.parse` understands; allow a few seconds of tolerance for clock skew.
- **Risks:** a client whose clock runs ahead by milliseconds gets a 400. Documented. Tolerance can be added later without breaking compatibility.

### AD-7 Short list of popular currencies — Confirmed (D18)
- **Why:** `Intl.supportedValuesOf('currency')` (the original notes) also returns historic codes and X-codes such as `XAU`, `XXX`, `XTS` and `DEM`, which conflicts with D18. A full ISO 4217 list is more than the homework needs.
- **How:** `CURRENCIES` in `src/utils/constants.js` is a frozen `Set` of popular active ISO 4217 codes: `USD`, `EUR`, `GBP`, `JPY`, `CHF`, `CAD`, `AUD`, `CNY`, `SEK`, `NOK`, `DKK`, `PLN`, `CZK`, `UAH`. Any other code gives 400 with the message `Unsupported currency code. Supported: …`, built from the same `Set`. The README API reference lists the codes.
- **Alternatives:** the full ISO 4217 List One (about 180 codes, has to be maintained); an npm package (needs to be trusted and updated); `Intl` minus exclusions (still lets historic codes through).
- **Trade-offs:** no dependency, fully predictable.
- **Risks:** the list goes stale when ISO adds or retires codes, which is rare. Update it by hand and note the date.

### AD-8 Derived balances and deterministic ordering — Confirmed (D2, D10)
- **Why:** there is one source of truth, the transactions, so there are no running balances that can drift.
- **How:**
  - The funds check and balance scan the account's completed transactions on each request.
  - Sorting is by `timestamp` descending, then `seq` descending, so a later-created transaction comes first.
  - The funds check uses all completed transactions at processing time, regardless of their timestamps (FR-1.7).
- **Alternatives:** a balance map kept up to date on every write (O(1) reads, but a second state).
- **Trade-offs:** reads cost O(n).
- **Risks:** slower with very large in-memory datasets. Out of scope.

### AD-9 Jest + supertest — Confirmed
- **Why:** in the original notes. It has mature coverage thresholds and mocking, and supertest runs HTTP tests against `app` without a port.
- **Alternatives:** `node:test` with `c8` (no dependency); Vitest (mainly suited to ESM).
- **Trade-offs:** heavier dev dependencies.
- **Risks:** none significant.

### AD-10 ESLint (flat config) + Prettier — Confirmed
- **Why:** consistent style and early bug detection.
- **Configuration:** `@eslint/js` recommended rules, with `globals.node` and `globals.jest`. `eslint-config-prettier` stops the two tools conflicting. Prettier uses its defaults.
- **Alternatives:** Biome (one tool, faster, smaller ecosystem); ESLint only.
- **Trade-offs:** about five more dev dependencies.
- **Risks:** none significant.


---

## 15. Implementation tasks and dependencies

| Task | Description | Delivers | Depends on |
|---|---|---|---|
| **Phase 0 — Foundation (M1)** ||||
| T0.1 | `package.json` with engines, scripts and dependencies; lockfile; `homework-1/.gitignore` | Phase 0 DoD | — |
| T0.2 | `config.js`, `app.js` (JSON parser, `x-powered-by` off), `server.js` | Phase 0 | T0.1 |
| T0.3 | Error classes, `notFound`, `errorHandler` (400 parse error, 404, 500) | FR-7.2 | T0.2 |
| T0.4 | `requestLogger` | §10.2 | T0.2 |
| T0.5 | `GET /health` | FR-8.1, D8 | T0.2 |
| T0.6 | Jest config with coverage threshold (configured now, a DoD gate from Phase 5); first integration test (health, 404) | D5, D7 | T0.3, T0.5 |
| T0.7 | ESLint and Prettier configs and scripts | AD-10 | T0.1 |
| **Phase 1 — Recording + validation (M2)** ||||
| T1.1 | `constants.js` (incl. `CURRENCIES`) | FR-4.3, FR-4.4, D18, AD-7 | T0.1 |
| T1.2 | `utils/money.js` | FR-4.1, D11, AD-4, AD-5 | T0.1 |
| T1.3 | `utils/dates.js` | FR-1.3, FR-4.5, D1, D21 | T0.1 |
| T1.4 | `transactionValidator` (collect all, unknown fields, type rules) | FR-1.6, FR-4, D14, D16 | T1.1–T1.3 |
| T1.5 | `transactionStore` | FR-1, FR-2, AD-3 | T0.1 |
| T1.6 | `transactionService.create` (ID, default timestamp, `completed`), `list` (sorted), `getById` | FR-1.1–FR-1.5, FR-2, D10, D13 | T1.4, T1.5 |
| T1.7 | Routes: POST, GET list, GET by ID | FR-1, FR-2 | T1.6, T0.3 |
| T1.8 | Unit and integration tests for Phase 1 acceptance | Phase 1 DoD | T1.7 |
| **Phase 2 — Balance + status rules (M2)** ||||
| T2.1 | `accountService.getBalance` (integer-hundredths sums, per currency) | FR-3, D3, D4, AD-8 | T1.5, T1.2 |
| T2.2 | Funds check and `failureReason` in `create` | FR-1.7, D2 | T2.1, T1.6 |
| T2.3 | `accountIdValidator` and `GET /accounts/:accountId/balance` | FR-3.4, FR-4.2, D22 | T2.1 |
| T2.4 | Tests, including the TASKS.md sample flow (UF-2) | Phase 2 DoD | T2.2, T2.3 |
| **Phase 3 — Filtering (M3)**, can run in parallel with Phase 2 after Phase 1 ||||
| T3.1 | `queryValidator` (allowed keys, scalars, formats, from ≤ to) | FR-5.5, FR-5.6, D12, D16 | T1.1, T1.3 |
| T3.2 | Filter logic in `transactionService.list` | FR-5.1–FR-5.4, FR-5.7, D15, D21 | T1.6 |
| T3.3 | Connect to `GET /transactions` | FR-5 | T3.1, T3.2 |
| T3.4 | Tests | Phase 3 DoD | T3.3 |
| **Phase 4 — Summary (M3)** ||||
| T4.1 | `accountService.getSummary` | FR-6, D19, D20 | T2.1 |
| T4.2 | `GET /accounts/:accountId/summary` | FR-6.1 | T4.1, T2.3 |
| T4.3 | Tests, including the deposits − withdrawals = balance invariant | Phase 4 DoD | T4.2 |
| **Phase 5 — Quality (M4)** ||||
| T5.1 | Edge-case catalogue (§11) | Phase 5 | T2.4, T3.4, T4.3 |
| T5.2 | Coverage ≥ 80% verified with `npm run test:coverage`; fix gaps | D7 | T5.1, T0.6 |
| **Phase 6 — Demo tooling (M4)** ||||
| T6.1 | `sample-data.json`: deposits first, January 2024 timestamps, several currencies, one intentional `failed` | Phase 6, UF-2 | Phases 1–4 |
| T6.2 | `seed.js` (POST in order; report results) | Phase 6 | T6.1 |
| T6.3 | `run.sh` (`npm ci` if needed, start, poll `/health`, run `seed.js` unless `--no-seed`) | Phase 6, UF-7, UF-2 | T0.5, T6.2 |
| T6.4 | `sample-requests.http` (UF-2 order plus error cases) | Phase 6 | T6.2 |
| **Phase 7 — Documentation (M4)** ||||
| T7.1 | README: overview, features, decisions D1–D22 and AD-x, API reference (§6), known limitations | Phase 7 | Phases 0–6 |
| T7.2 | HOWTORUN: prerequisites, install, run (with and without sample data, and why the sample transfer fails on an empty system), environment variables, tests and coverage, lint, demo | Phase 7 | Phases 0–6 |

**Critical path:** T0.1 → T1.1–T1.3 → T1.4 → T1.6 → T1.7 → T1.8 → T2.1 → T2.2 → T2.4 → T4.1 → T4.2 → T4.3 → T5.1 → T5.2 → T7.1.
Task dependencies alone would allow some tasks to start earlier. Each phase still starts only after the previous phase meets its Definition of Done (D5).

**Known limitations to document in the README:**
- no authentication;
- no rate limiting;
- data lost on restart;
- JPY and similar currencies accept 2 decimals (D17);
- a single transaction is limited to 1,000,000,000.00 (D11, AD-5);
- zero tolerance for future timestamps (AD-6);
- only a short list of popular currencies is supported, and other valid ISO 4217 codes are reported as unsupported (D18, AD-7);
- `+` in a date-time offset must be URL-encoded as `%2B` in filters (AD-6).

---

## 16. Reviewed details

These details were introduced in this document. They were reviewed and approved during the plan review ([plan-review.md](plan-review.md), F10):

| # | Item | Status | Note |
|---|---|---|---|
| R1 | A transaction response always includes both `fromAccount` and `toAccount`, with `null` where they don't apply (for example `fromAccount: null` on a deposit) | Confirmed | Clients always see the same shape. |
| R2 | The body `timestamp` must include a timezone offset (`Z` or `±hh:mm`). Without one, it gives 400. | Confirmed | Now part of product decisions D1 and D21. |
| R3 | Unknown route body is `{"error":"Not found"}`. A malformed-JSON error is reported as `field: "body"`. | Confirmed | Consistent with FR-7.2. |
| R4 | Empty query values (for example `?type=`) give 400 | Confirmed | Follows from strict validation (D16). |
| R5 | Request logs never include request bodies | Confirmed | Privacy-friendly default. |

No **Requires approval** items or **Open questions** remain.
