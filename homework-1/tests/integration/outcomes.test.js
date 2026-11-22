"use strict";

const request = require("supertest");
const store = require("../../src/store/transactionStore");
const { app, validBody, postTransaction } = require("../helpers/transactions");

/**
 * End-to-end check that every endpoint uses the four outcomes the specification
 * requires, and that every error body follows the documented contract (§6.7).
 */
describe("Outcomes and error contract across endpoints (FR-7)", () => {
  beforeEach(() => store.reset());

  it("FR-7.1 success, created, invalid request and not found map to 200, 201, 400 and 404", async () => {
    const created = await postTransaction(validBody.deposit());
    expect(created.status).toBe(201);

    const ok = [
      "/health",
      "/transactions",
      `/transactions/${created.body.id}`,
      "/transactions?type=deposit",
      "/accounts/ACC-12345/balance",
      "/accounts/ACC-12345/summary",
    ];
    for (const path of ok) {
      expect([path, (await request(app).get(path)).status]).toEqual([
        path,
        200,
      ]);
    }

    expect((await postTransaction({})).status).toBe(400);
    expect((await request(app).get("/transactions?type=x")).status).toBe(400);
    expect((await request(app).get("/accounts/bad/balance")).status).toBe(400);
    expect((await request(app).get("/accounts/bad/summary")).status).toBe(400);

    expect(
      (
        await request(app).get(
          "/transactions/00000000-0000-4000-8000-000000000000",
        )
      ).status,
    ).toBe(404);
    expect((await request(app).get("/nope")).status).toBe(404);
  });

  it.each([
    [
      "POST /transactions with an invalid body",
      () => postTransaction({ type: "x" }),
    ],
    [
      "GET /transactions with an invalid filter",
      () => request(app).get("/transactions?from=x"),
    ],
    [
      "GET balance with a malformed accountId",
      () => request(app).get("/accounts/x/balance"),
    ],
    [
      "GET summary with an unknown query parameter",
      () => request(app).get("/accounts/ACC-12345/summary?a=1"),
    ],
  ])(
    "FR-7.3 a 400 from %s follows the §6.7 validation contract",
    async (_label, send) => {
      const res = await send();

      expect(res.status).toBe(400);
      expect(res.headers["content-type"]).toMatch(/application\/json/);
      expect(Object.keys(res.body)).toEqual(["error", "details"]);
      expect(res.body.error).toBe("Validation failed");
      expect(res.body.details.length).toBeGreaterThan(0);
      for (const d of res.body.details) {
        expect(Object.keys(d)).toEqual(["field", "message"]);
        expect(typeof d.field).toBe("string");
        expect(typeof d.message).toBe("string");
      }
    },
  );

  it.each([
    [
      "an unknown transaction",
      "/transactions/00000000-0000-4000-8000-000000000000",
      "Transaction not found",
    ],
    ["an unknown route", "/nope", "Not found"],
  ])(
    "FR-7.3 a 404 for %s has only an error message",
    async (_label, path, message) => {
      const res = await request(app).get(path);

      expect(res.status).toBe(404);
      expect(res.headers["content-type"]).toMatch(/application\/json/);
      expect(res.body).toEqual({ error: message });
    },
  );
});
