"use strict";

/**
 * Phase 6 acceptance: the sample data loads with only the intentional failures, and
 * every request in demo/sample-requests.http returns the outcome written next to it.
 * Runs against a real HTTP server on an ephemeral port, the way run.sh does.
 */
const fs = require("node:fs");
const path = require("node:path");
const store = require("../../src/store/transactionStore");
const { app } = require("../helpers/transactions");
const { seed, defaultBaseUrl } = require("../../demo/seed");

const DEMO = path.join(__dirname, "..", "..", "demo");
const { transactions: SAMPLE } = JSON.parse(
  fs.readFileSync(path.join(DEMO, "sample-data.json"), "utf8"),
);

/**
 * Minimal REST Client parser: requests separated by "###", with "# Expected: ..."
 * and optional "# @name x" comment lines, a request line, headers, blank line, body.
 */
function parseHttpFile(text) {
  return text
    .split(/^###.*$/m)
    .slice(1)
    .map((block) => {
      const lines = block.split("\n");
      const expected = lines
        .find((l) => l.startsWith("# Expected:"))
        .slice("# Expected:".length)
        .trim();
      const name = (lines.find((l) => l.startsWith("# @name ")) || "")
        .slice("# @name ".length)
        .trim();
      const content = lines.filter((l) => !l.startsWith("#"));
      const start = content.findIndex((l) => /^[A-Z]+ /.test(l));
      const [method, url] = content[start].split(" ");
      const headers = {};
      let i = start + 1;
      for (; i < content.length && content[i].trim() !== ""; i++) {
        const [key, ...rest] = content[i].split(":");
        headers[key.trim()] = rest.join(":").trim();
      }
      const body = content
        .slice(i + 1)
        .join("\n")
        .trim();
      return { expected, name, method, url, headers, body: body || undefined };
    });
}

/**
 * Turns an "Expected:" line into checks:
 *   `201, status "completed"`            → code, transaction status
 *   `200, 3 transactions`                → array length
 *   `failureReason "X"`                  → every listed transaction has that reason
 *   `200 {...}`                          → exact body
 *   `200 matching {...}`                 → body contains these fields
 *   `400 with details for a, b and c`    → exactly these `details` fields
 */
function parseExpected(expected) {
  const code = Number(expected.match(/^\d{3}/)[0]);
  const status = (expected.match(/status "(\w+)"/) || [])[1];
  const failureReason = (expected.match(/failureReason "(\w+)"/) || [])[1];
  const count = (expected.match(/\b(\d+) (?:\w+ ){0,4}transactions?\b/) ||
    [])[1];
  const exact = (expected.match(/^\d{3} (\{.*\})$/) || [])[1];
  const partial = (expected.match(/^\d{3} matching (\{.*\})$/) || [])[1];
  const details = (expected.match(/with details for (.+)$/) || [])[1];
  return {
    code,
    status,
    failureReason,
    count: count === undefined ? undefined : Number(count),
    exact: exact === undefined ? undefined : JSON.parse(exact),
    partial: partial === undefined ? undefined : JSON.parse(partial),
    detailFields: details === undefined ? undefined : details.split(/, | and /),
  };
}

describe("demo tooling (Phase 6)", () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => store.reset());

  describe("sample-data.json", () => {
    it("UF-2 deposits come first, so ACC-12345 is funded before it spends", () => {
      const firstSpend = SAMPLE.findIndex(
        (t) => t.body.fromAccount === "ACC-12345",
      );
      const funding = SAMPLE.findIndex(
        (t) => t.body.type === "deposit" && t.body.toAccount === "ACC-12345",
      );
      expect(funding).toBe(0);
      expect(firstSpend).toBeGreaterThan(funding);
    });

    it("UF-2 has January 2024 transactions in more than one currency", () => {
      const january = SAMPLE.filter((t) =>
        t.body.timestamp.startsWith("2024-01-"),
      );
      expect(january.length).toBeGreaterThan(1);
      expect(new Set(SAMPLE.map((t) => t.body.currency)).size).toBeGreaterThan(
        1,
      );
    });

    it("FR-1.7 at least one transaction is an intentional failure", () => {
      expect(SAMPLE.some((t) => t.expectedStatus === "failed")).toBe(true);
    });
  });

  describe("seed.js", () => {
    it("FR-1.7 loads every sample transaction with its expected status, failing only the intentional ones", async () => {
      const lines = [];
      const { ok, results } = await seed({
        baseUrl,
        entries: SAMPLE,
        log: (l) => lines.push(l),
      });

      expect(ok).toBe(true);
      expect(results).toHaveLength(SAMPLE.length);
      expect(results.every((r) => r.httpStatus === 201)).toBe(true);
      expect(
        store
          .getAll()
          .filter((r) => r.status === "failed")
          .map((r) => r.timestamp),
      ).toEqual(
        SAMPLE.filter((t) => t.expectedStatus === "failed").map((t) =>
          new Date(t.body.timestamp).toISOString(),
        ),
      );
      expect(lines.at(-1)).toBe(
        `Loaded ${SAMPLE.length} sample transactions into ${baseUrl}.`,
      );
    });

    it("FR-1.7 reports a mismatch when a transaction does not end as expected", async () => {
      const lines = [];
      const { ok, results } = await seed({
        baseUrl,
        entries: [{ ...SAMPLE[7], expectedStatus: "completed" }],
        log: (l) => lines.push(l),
      });

      expect(ok).toBe(false);
      expect(results[0]).toMatchObject({ status: "failed", ok: false });
      expect(lines[0]).toMatch(/^FAIL 201 failed/);
      expect(lines.at(-1)).toBe(
        "1 of 1 sample transactions did not load as expected.",
      );
    });

    it("FR-4.6 shows the validation details when a request is rejected", async () => {
      const lines = [];
      const { ok } = await seed({
        baseUrl,
        entries: [
          {
            note: "bad",
            expectedStatus: "completed",
            body: { ...SAMPLE[0].body, amount: "100" },
          },
        ],
        log: (l) => lines.push(l),
      });

      expect(ok).toBe(false);
      expect(lines[0]).toMatch(/^FAIL 400 -/);
      expect(lines[0]).toContain('"field":"amount"');
    });

    it("UF-7 defaults to BASE_URL, then PORT, then port 3000", () => {
      expect(defaultBaseUrl({ BASE_URL: "http://x:1" })).toBe("http://x:1");
      expect(defaultBaseUrl({ PORT: "4000" })).toBe("http://localhost:4000");
      expect(defaultBaseUrl({})).toBe("http://localhost:3000");
    });
  });

  describe("sample-requests.http", () => {
    const requests = parseHttpFile(
      fs.readFileSync(path.join(DEMO, "sample-requests.http"), "utf8"),
    );

    it("UF-2 starts with the specification's sample requests in order", () => {
      expect(requests.slice(1, 6).map((r) => `${r.method} ${r.url}`)).toEqual([
        "POST {{baseUrl}}/transactions",
        "GET {{baseUrl}}/transactions",
        "GET {{baseUrl}}/transactions?accountId=ACC-12345",
        "GET {{baseUrl}}/transactions?from=2024-01-01&to=2024-01-31",
        "GET {{baseUrl}}/accounts/ACC-12345/balance",
      ]);
    });

    it("UF-2 every request returns the outcome written next to it, after seeding", async () => {
      const { ok } = await seed({ baseUrl, entries: SAMPLE, log: () => {} });
      expect(ok).toBe(true);

      const named = {};
      for (const req of requests) {
        const url = req.url
          .replace("{{baseUrl}}", baseUrl)
          .replace(
            /\{\{(\w+)\.response\.body\.\$\.(\w+)\}\}/g,
            (_m, name, field) => named[name][field],
          );
        const res = await fetch(url, {
          method: req.method,
          headers: req.headers,
          body: req.body,
        });
        const body = await res.json();
        const want = parseExpected(req.expected);
        const label = `${req.method} ${req.url}`;

        expect([label, res.status]).toEqual([label, want.code]);
        if (want.status)
          expect([label, body.status]).toEqual([label, want.status]);
        if (want.count !== undefined) {
          expect([label, body.length]).toEqual([label, want.count]);
        }
        if (want.failureReason) {
          expect([label, body.map((t) => t.failureReason)]).toEqual([
            label,
            body.map(() => want.failureReason),
          ]);
        }
        if (want.exact) expect([label, body]).toEqual([label, want.exact]);
        if (want.partial) expect(body).toMatchObject(want.partial);
        if (want.detailFields) {
          expect([label, body.details.map((d) => d.field)]).toEqual([
            label,
            want.detailFields,
          ]);
        }
        if (req.name) named[req.name] = body;
      }
    });
  });
});
