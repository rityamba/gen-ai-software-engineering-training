# ▶️ How to Run the application

All commands below are run from the `homework-1/` directory.

## Quick start

```bash
cd homework-1
demo/run.sh
```

This installs dependencies if needed, starts the API on port 3000, waits until it is healthy and loads the sample data. Then open `demo/sample-requests.http` (see [Try the API](#try-the-api)). Press `Ctrl+C` to stop.

## Prerequisites

- Node.js 22 or newer (developed on Node.js 26)
- npm (comes with Node.js)
- macOS, Linux or WSL for `demo/run.sh` (it is a bash script). On plain Windows, use `npm start` and `node demo/seed.js` instead.
- Optional, to send the sample requests: VS Code with the **REST Client** extension (`humao.rest-client`), or the Postman app / Postman CLI.

Check your versions:

```bash
node -v
npm -v
```

## Install

```bash
npm install
```

`demo/run.sh` runs `npm ci` by itself when `node_modules/` is missing.

## Run the API

### With sample data (recommended)

```bash
demo/run.sh
```

Expected output:

```
Banking Transactions API listening on port 3000 (development)
GET /health 200 3.2ms
POST /transactions 201 3.7ms
ok   201 completed  deposit 5000 USD -> ACC-12345  (Fund ACC-12345 in USD)
POST /transactions 201 0.4ms
...
ok   201 failed     withdrawal 2000 GBP <- ACC-12345  (Intentional failure: ACC-12345 has no GBP (INSUFFICIENT_FUNDS))
...
Loaded 10 sample transactions into http://localhost:3000.
API is running at http://localhost:3000. Try demo/sample-requests.http. Press Ctrl+C to stop.
```

The `GET` / `POST` lines are the server's request log (development mode); the `ok` lines come from the seeding script.

The sample data (`demo/sample-data.json`) has 10 transactions: deposits first, so ACC-12345 is funded; dates in January 2024 plus one in February; USD, EUR, GBP and UAH; and exactly one intentional `failed` transaction (a GBP withdrawal from an account that holds no GBP). If any transaction loads with an unexpected result, the script stops with an error.

If the port is already in use, `run.sh` stops with `Port 3000 is already in use` instead of loading data into another server.

### Without sample data

```bash
demo/run.sh --no-seed
# or
npm start
```

> **The sample transfer fails on an empty system, and that is expected.** The task's sample request transfers 100.50 USD from ACC-12345 to ACC-67890. On an empty server ACC-12345 has no money, so the API records the transfer with `"status": "failed"` and `"failureReason": "INSUFFICIENT_FUNDS"` (still `201 Created`: the request was valid, only the operation failed). Start with sample data, or post a deposit to ACC-12345 first, and the same transfer completes.

To load the sample data into a server that is already running (each run adds the 10 transactions again):

```bash
node demo/seed.js                       # http://localhost:3000
node demo/seed.js http://localhost:4000 # another address
```

### Check that it is running

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

Stop the server with `Ctrl+C`. Data is in memory, so every start begins empty (or with fresh sample data).

### Development mode (auto-restart on file changes)

```bash
npm run dev
```

### Environment variables

| Variable   | Default       | Description                                                                  |
| ---------- | ------------- | ---------------------------------------------------------------------------- |
| `PORT`     | `3000`        | Port the server listens on (also used by `demo/run.sh` and `demo/seed.js`)   |
| `NODE_ENV` | `development` | `test` disables request logging                                              |
| `BASE_URL` | —             | Address `demo/seed.js` posts to, if no argument is given                     |

Example with a different port:

```bash
PORT=4000 demo/run.sh
PORT=4000 npm start
```

## Try the API

### VS Code REST Client

1. Install the **REST Client** extension (by Huachao Mao) in VS Code.
2. Start the API with `demo/run.sh` (with sample data).
3. Open `demo/sample-requests.http` and click **Send Request** above each request, top to bottom (or put the cursor in a request and press `Cmd+Alt+R` / `Ctrl+Alt+R`).

The file has 24 requests. The first six are the task's sample requests in order (health, the sample transfer, all transactions, transactions for ACC-12345, the January 2024 date range, the ACC-12345 balance); then every other endpoint and the error cases. Each request has an `# Expected:` line with the status and result to compare with. The expected values assume a freshly seeded server and requests sent in order: restart `demo/run.sh` to start over. Request 7 reuses the id returned by request 2, so send request 2 first.

### curl

```bash
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-12345","toAccount":"ACC-67890","amount":100.50,"currency":"USD","type":"transfer"}'

curl http://localhost:3000/transactions
curl "http://localhost:3000/transactions?accountId=ACC-12345"
curl "http://localhost:3000/transactions?from=2024-01-01&to=2024-01-31"
curl http://localhost:3000/accounts/ACC-12345/balance
curl http://localhost:3000/accounts/ACC-12345/summary
```

### Postman

The collection `postman/banking-transactions-api.postman_collection.json` covers every endpoint, with test scripts on each request. It uses its own accounts (ACC-PMA01, ACC-PMB01), so it passes on an empty server and on one started with `demo/run.sh`, and can be run repeatedly.

- **Postman app:** import the collection and `postman/local.postman_environment.json`, select the environment, and run the collection with the Collection Runner (folders in order).
- **Postman CLI**, with the API running:

  ```bash
  postman collection run postman/banking-transactions-api.postman_collection.json \
    -e postman/local.postman_environment.json
  ```

  Expected: 60 requests and 151 assertions, 0 failed.

## Run the tests

```bash
npm test
```

The suite has 434 tests (unit and integration, Jest + supertest). It needs no running server: integration tests start the app in-process, and `tests/integration/demo.test.js` runs every request in `demo/sample-requests.http` against a seeded server on a random port.

### Test coverage

```bash
npm run test:coverage
```

This prints a coverage table and fails if line or branch coverage is below 80% (it is currently 100%). The HTML report is written to `coverage/lcov-report/index.html`.

### Run tests for one requirement

Every requirement (FR-x) and every behavioural decision (D-x, AD-x) in the plans has at least one test whose name starts with its ID, so you can filter by it. Decisions about process and tooling (D5, D6, D9, AD-1, AD-9, AD-10) have no test of their own; `tests/traceability.test.js` lists them with the reason.

```bash
npx jest -t 'FR-8\.1'
npx jest -t 'D2\b'      # \b stops D2 from also matching D20, D21 and D22
npx jest tests/traceability.test.js --verbose   # one line per requirement ID
```

## Lint and formatting

```bash
npm run lint           # check code with ESLint
npm run lint:fix       # fix what ESLint can fix automatically
npm run format:check   # check formatting with Prettier
npm run format         # apply Prettier formatting
```
