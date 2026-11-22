#!/usr/bin/env node
"use strict";

/**
 * Loads demo/sample-data.json into a running API by POSTing each transaction in order
 * (Phase 6, UF-2). Reports one line per transaction and fails when a request is not
 * created or ends with a status other than the one the sample data expects.
 *
 * Usage: node demo/seed.js [baseUrl]
 *   baseUrl defaults to $BASE_URL, then http://localhost:$PORT (PORT defaults to 3000).
 */
const path = require("node:path");

const DEFAULT_DATA = path.join(__dirname, "sample-data.json");

function defaultBaseUrl(env = process.env) {
  return env.BASE_URL || `http://localhost:${env.PORT || 3000}`;
}

function describe(body) {
  const route =
    body.type === "deposit"
      ? `-> ${body.toAccount}`
      : body.type === "withdrawal"
        ? `<- ${body.fromAccount}`
        : `${body.fromAccount} -> ${body.toAccount}`;
  return `${body.type} ${body.amount} ${body.currency} ${route}`;
}

/**
 * @param {{baseUrl: string, entries: {note: string, expectedStatus: string, body: object}[],
 *          log?: (line: string) => void}} options
 * @returns {Promise<{ok: boolean, results: object[]}>}
 */
async function seed({ baseUrl, entries, log = console.log }) {
  const results = [];
  for (const entry of entries) {
    const res = await fetch(`${baseUrl}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry.body),
    });
    const payload = await res.json().catch(() => null);
    const status = payload && payload.status;
    const ok = res.status === 201 && status === entry.expectedStatus;
    results.push({
      note: entry.note,
      httpStatus: res.status,
      status,
      expectedStatus: entry.expectedStatus,
      ok,
    });
    log(
      `${ok ? "ok  " : "FAIL"} ${res.status} ${status ?? "-"}`.padEnd(20) +
        `${describe(entry.body)}  (${entry.note})` +
        (ok
          ? ""
          : ` -- expected 201 ${entry.expectedStatus}` +
            (payload && payload.details
              ? `: ${JSON.stringify(payload.details)}`
              : "")),
    );
  }
  const failed = results.filter((r) => !r.ok).length;
  log(
    failed === 0
      ? `Loaded ${results.length} sample transactions into ${baseUrl}.`
      : `${failed} of ${results.length} sample transactions did not load as expected.`,
  );
  return { ok: failed === 0, results };
}

async function main() {
  const baseUrl = (process.argv[2] || defaultBaseUrl()).replace(/\/$/, "");
  const { transactions } = require(DEFAULT_DATA);
  try {
    const { ok } = await seed({ baseUrl, entries: transactions });
    process.exitCode = ok ? 0 : 1;
  } catch (err) {
    console.error(
      `Cannot reach ${baseUrl} (${err.cause?.code || err.message}). Is the API running?`,
    );
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { seed, defaultBaseUrl };
