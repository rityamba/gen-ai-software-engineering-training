# ▶️ How to Run the application

All commands below are run from the `homework-1/` directory.

## Prerequisites

- Node.js 22 or newer (developed on Node.js 26)
- npm (comes with Node.js)

Check your versions:

```bash
node -v
npm -v
```

## Install

```bash
npm install
```

## Run the API

```bash
npm start
```

The server listens on port `3000` by default:

```
Banking Transactions API listening on port 3000 (development)
```

Check that it is running:

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

Stop the server with `Ctrl+C`.

### Development mode (auto-restart on file changes)

```bash
npm run dev
```

### Environment variables

| Variable   | Default       | Description                     |
| ---------- | ------------- | ------------------------------- |
| `PORT`     | `3000`        | Port the server listens on      |
| `NODE_ENV` | `development` | `test` disables request logging |

Example with a different port:

```bash
PORT=4000 npm start
```

## Run the tests

```bash
npm test
```

### Test coverage

```bash
npm run test:coverage
```

This prints a coverage table and fails if line or branch coverage is below 80%. The HTML report is written to `coverage/lcov-report/index.html`.

### Run tests for one requirement

Every test name starts with the requirement ID it checks, so you can filter by it:

```bash
npx jest -t FR-8.1
```

## Lint and formatting

```bash
npm run lint           # check code with ESLint
npm run lint:fix       # fix what ESLint can fix automatically
npm run format:check   # check formatting with Prettier
npm run format         # apply Prettier formatting
```
