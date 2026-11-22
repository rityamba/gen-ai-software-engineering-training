"use strict";

const request = require("supertest");
const store = require("../../src/store/transactionStore");
const { app, validBody, postTransaction } = require("../helpers/transactions");

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("Transactions API", () => {
  beforeEach(() => store.reset());

  describe("POST /transactions", () => {
    it("FR-1.5 creates the TASKS.md sample transfer with 201", async () => {
      // UF-2: ACC-12345 is funded first, otherwise the funds rule (FR-1.7) fails it.
      await postTransaction(validBody.deposit({ amount: 500 }));

      const res = await postTransaction({
        fromAccount: "ACC-12345",
        toAccount: "ACC-67890",
        amount: 100.5,
        currency: "USD",
        type: "transfer",
      });

      expect(res.status).toBe(201);
      expect(res.headers["content-type"]).toMatch(/application\/json/);
      expect(res.body).toEqual({
        id: expect.stringMatching(UUID_V4),
        fromAccount: "ACC-12345",
        toAccount: "ACC-67890",
        amount: 100.5,
        currency: "USD",
        type: "transfer",
        timestamp: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        ),
        status: "completed",
      });
      expect(res.headers.location).toBe(`/transactions/${res.body.id}`);
    });

    it("D1 a missing timestamp is set to the current time", async () => {
      const before = Date.now();
      const res = await postTransaction(validBody.deposit());
      const after = Date.now();

      const ts = Date.parse(res.body.timestamp);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it("D1 a supplied past timestamp is kept", async () => {
      const res = await postTransaction(
        validBody.deposit({ timestamp: "2024-01-15T10:30:00Z" }),
      );

      expect(res.status).toBe(201);
      expect(res.body.timestamp).toBe("2024-01-15T10:30:00.000Z");
    });

    it("R1 a deposit returns fromAccount null and a withdrawal toAccount null", async () => {
      const deposit = await postTransaction(validBody.deposit());
      const withdrawal = await postTransaction(validBody.withdrawal());

      expect(deposit.body.fromAccount).toBeNull();
      expect(withdrawal.body.toAccount).toBeNull();
    });

    it("D14 stores account ids in upper case, so any spelling is the same account", async () => {
      const deposit = await postTransaction(
        validBody.deposit({ toAccount: "acc-ab12c" }),
      );
      const withdrawal = await postTransaction(
        validBody.withdrawal({ fromAccount: "Acc-Ab12C", amount: 100.5 }),
      );

      expect(deposit.status).toBe(201);
      expect(deposit.body.toAccount).toBe("ACC-AB12C");
      expect(withdrawal.body.fromAccount).toBe("ACC-AB12C");
      expect(withdrawal.body.status).toBe("completed");
    });

    it("D18 accepts any active ISO 4217 currency, not only the popular ones", async () => {
      const res = await postTransaction(validBody.deposit({ currency: "INR" }));

      expect(res.status).toBe(201);
      expect(res.body.currency).toBe("INR");
    });

    it("FR-4.1 accepts up to 2 decimal places in any supported currency", async () => {
      const res = await postTransaction(
        validBody.deposit({ amount: 0.01, currency: "JPY" }),
      );

      expect(res.status).toBe(201);
      expect(res.body.amount).toBe(0.01);
    });

    it("D11/AD-5 accepts exactly the maximum amount", async () => {
      const res = await postTransaction(
        validBody.deposit({ amount: 1000000000 }),
      );

      expect(res.status).toBe(201);
      expect(res.body.amount).toBe(1000000000);
    });
  });

  describe("POST /transactions — invalid input (FR-4, FR-1.8)", () => {
    it.each([
      ["zero amount", { amount: 0 }, "amount"],
      ["negative amount", { amount: -10 }, "amount"],
      ["more than 2 decimal places", { amount: 100.123 }, "amount"],
      ["amount above the maximum", { amount: 1000000000.01 }, "amount"],
      ["amount as text", { amount: "100" }, "amount"],
      ["malformed account", { toAccount: "ACC-1" }, "toAccount"],
      ["wrong account prefix", { toAccount: "AC-12345" }, "toAccount"],
      ["lower-case currency", { currency: "usd" }, "currency"],
      ["unknown currency", { currency: "ABC" }, "currency"],
      ["special currency", { currency: "XXX" }, "currency"],
      ["inactive currency", { currency: "DEM" }, "currency"],
      ["unknown type", { type: "refund" }, "type"],
      [
        "timestamp without timezone",
        { timestamp: "2024-01-15T10:30:00" },
        "timestamp",
      ],
      [
        "impossible timestamp",
        { timestamp: "2024-02-30T10:30:00Z" },
        "timestamp",
      ],
      ["future timestamp", { timestamp: "2999-01-01T00:00:00Z" }, "timestamp"],
      ["unknown field", { note: "x" }, "note"],
      ["client-sent id", { id: "abc" }, "id"],
      ["client-sent status", { status: "completed" }, "status"],
      [
        "forbidden fromAccount on a deposit",
        { fromAccount: "ACC-11111" },
        "fromAccount",
      ],
    ])(
      "FR-4/FR-1.8 rejects %s with 400, names the field and stores nothing",
      async (_label, override, field) => {
        const res = await postTransaction(validBody.deposit(override));

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Validation failed");
        expect(res.body.details.map((d) => d.field)).toContain(field);
        expect(store.getAll()).toHaveLength(0);
      },
    );

    it("FR-1.6 rejects a transfer to the same account", async () => {
      const res = await postTransaction(
        validBody.transfer({ toAccount: "ACC-12345" }),
      );

      expect(res.status).toBe(400);
      expect(res.body.details).toEqual([
        {
          field: "toAccount",
          message: "toAccount must be different from fromAccount",
        },
      ]);
    });

    it("FR-4.6 reports several invalid fields together (UF-3)", async () => {
      const res = await postTransaction(
        validBody.deposit({ amount: -5, currency: "XYZ" }),
      );

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: "Validation failed",
        details: [
          { field: "amount", message: "Amount must be a positive number" },
          {
            field: "currency",
            message:
              "Invalid currency code. Use an active ISO 4217 code in upper case, e.g. USD, EUR or GBP",
          },
        ],
      });
      expect(store.getAll()).toHaveLength(0);
    });

    it.each([
      ["a JSON array", "[]", "application/json"],
      [
        "a missing Content-Type",
        JSON.stringify(validBody.deposit()),
        undefined,
      ],
      [
        "a text/plain Content-Type",
        JSON.stringify(validBody.deposit()),
        "text/plain",
      ],
    ])(
      "FR-4.7 rejects %s with field body",
      async (_label, payload, contentType) => {
        let req = request(app).post("/transactions");
        if (contentType) req = req.set("Content-Type", contentType);
        const res = await req.send(payload);

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
          error: "Validation failed",
          details: [
            { field: "body", message: "Request body must be a JSON object" },
          ],
        });
      },
    );

    it("FR-7.2 rejects malformed JSON with 400", async () => {
      const res = await request(app)
        .post("/transactions")
        .set("Content-Type", "application/json")
        .send('{"amount": ');

      expect(res.status).toBe(400);
      expect(res.body.details).toEqual([
        { field: "body", message: "Malformed JSON" },
      ]);
    });
  });

  describe("GET /transactions", () => {
    it("FR-2.1 returns an empty array when nothing is stored", async () => {
      const res = await request(app).get("/transactions");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("FR-2.1 a created transaction appears in the list", async () => {
      const created = await postTransaction(validBody.deposit());
      const res = await request(app).get("/transactions");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([created.body]);
    });

    it("FR-2.3/D10 lists newest first by timestamp", async () => {
      await postTransaction(
        validBody.deposit({ timestamp: "2024-01-10T00:00:00Z" }),
      );
      await postTransaction(
        validBody.deposit({ timestamp: "2024-01-31T23:59:59Z" }),
      );
      await postTransaction(
        validBody.deposit({ timestamp: "2024-01-20T00:00:00Z" }),
      );

      const res = await request(app).get("/transactions");

      expect(res.body.map((t) => t.timestamp)).toEqual([
        "2024-01-31T23:59:59.000Z",
        "2024-01-20T00:00:00.000Z",
        "2024-01-10T00:00:00.000Z",
      ]);
    });
  });

  describe("GET /transactions/:id", () => {
    it("FR-2.2 returns the transaction by id", async () => {
      const created = await postTransaction(validBody.transfer());
      const res = await request(app).get(`/transactions/${created.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(created.body);
    });

    it.each([
      ["an unknown UUID", "00000000-0000-4000-8000-000000000000"],
      ["a malformed id", "not-a-uuid"],
      ["__proto__", "__proto__"],
    ])("FR-2.2/D13 returns 404 for %s, never 400", async (_label, id) => {
      const res = await request(app).get(`/transactions/${id}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Transaction not found" });
    });
  });

  describe("unsupported methods", () => {
    it("FR-7.2 returns 404 Not found for DELETE /transactions/:id (D22)", async () => {
      const created = await postTransaction(validBody.deposit());
      const res = await request(app).delete(`/transactions/${created.body.id}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Not found" });
      expect(store.getAll()).toHaveLength(1);
    });
  });
});
