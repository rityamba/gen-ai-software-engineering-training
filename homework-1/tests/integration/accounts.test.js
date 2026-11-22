"use strict";

const request = require("supertest");
const store = require("../../src/store/transactionStore");
const { app, validBody, postTransaction } = require("../helpers/transactions");

const A = "ACC-12345";
const B = "ACC-67890";

function getBalance(accountId) {
  return request(app).get(`/accounts/${accountId}/balance`);
}

describe("Accounts API", () => {
  beforeEach(() => store.reset());

  describe("GET /accounts/:accountId/balance", () => {
    it("FR-3.4/D4 an account with no transactions returns 200 and an empty balance", async () => {
      const res = await getBalance(A);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/json/);
      expect(res.body).toEqual({ accountId: A, balance: {} });
    });

    it("FR-3.1/FR-3.2 reflects a deposit, a transfer and a withdrawal for both accounts", async () => {
      await postTransaction(validBody.deposit({ amount: 300 }));
      await postTransaction(validBody.transfer({ amount: 100.5 }));
      await postTransaction(validBody.withdrawal({ amount: 49.5 }));

      expect((await getBalance(A)).body).toEqual({
        accountId: A,
        balance: { USD: 150 },
      });
      expect((await getBalance(B)).body).toEqual({
        accountId: B,
        balance: { USD: 100.5 },
      });
    });

    it("FR-3.3 reports each currency separately", async () => {
      await postTransaction(validBody.deposit({ amount: 10 }));
      await postTransaction(validBody.deposit({ amount: 20, currency: "EUR" }));

      expect((await getBalance(A)).body.balance).toEqual({ USD: 10, EUR: 20 });
    });

    it.each([
      ["lower-case prefix", "acc-12345"],
      ["too short", "ACC-1234"],
      ["unexpected characters", "ACC-12%2045"],
    ])("FR-4.2 a malformed accountId (%s) gives 400", async (_label, id) => {
      const res = await getBalance(id);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: "Validation failed",
        details: [
          {
            field: "accountId",
            message:
              "Account must match the format ACC-XXXXX, where X is a letter or digit",
          },
        ],
      });
    });

    it("D16 an unknown query parameter gives 400 instead of being ignored", async () => {
      await postTransaction(validBody.deposit({ amount: 10 }));

      const res = await request(app).get(`/accounts/${A}/balance?currency=USD`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: "Validation failed",
        details: [
          { field: "currency", message: 'Unknown query parameter "currency"' },
        ],
      });
    });

    it("D16 an empty or repeated query parameter is rejected too", async () => {
      const res = await request(app).get(`/accounts/${A}/balance?x=&y=1&y=2`);

      expect(res.status).toBe(400);
      expect(res.body.details).toEqual([
        { field: "x", message: 'Unknown query parameter "x"' },
        { field: "y", message: 'Unknown query parameter "y"' },
      ]);
    });

    it("D22 a malformed accountId and a query parameter are reported together", async () => {
      const res = await request(app).get(
        "/accounts/acc-1/balance?currency=USD",
      );

      expect(res.status).toBe(400);
      expect(res.body.details.map((d) => d.field)).toEqual([
        "accountId",
        "currency",
      ]);
    });
  });

  describe("funds rule (FR-1.7, D2)", () => {
    it("FR-1.7 a withdrawal without funds is stored as failed with 201 and INSUFFICIENT_FUNDS", async () => {
      const res = await postTransaction(validBody.withdrawal());

      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(`/transactions/${res.body.id}`);
      expect(res.body.status).toBe("failed");
      expect(res.body.failureReason).toBe("INSUFFICIENT_FUNDS");

      const stored = await request(app).get(`/transactions/${res.body.id}`);
      expect(stored.body).toEqual(res.body);
      expect((await request(app).get("/transactions")).body).toHaveLength(1);
    });

    it("FR-1.7 a failed transfer changes neither balance", async () => {
      await postTransaction(validBody.deposit({ amount: 50 }));
      const res = await postTransaction(validBody.transfer({ amount: 50.01 }));

      expect(res.body.status).toBe("failed");
      expect((await getBalance(A)).body.balance).toEqual({ USD: 50 });
      expect((await getBalance(B)).body.balance).toEqual({});
    });

    it("FR-1.7 spending the exact balance completes and leaves 0", async () => {
      await postTransaction(validBody.deposit({ amount: 20 }));
      const res = await postTransaction(validBody.withdrawal({ amount: 20 }));

      expect(res.body.status).toBe("completed");
      expect(res.body).not.toHaveProperty("failureReason");
      expect((await getBalance(A)).body.balance).toEqual({ USD: 0 });
    });

    it("D3 funds in another currency do not cover a transaction", async () => {
      await postTransaction(
        validBody.deposit({ amount: 1000, currency: "EUR" }),
      );
      const res = await postTransaction(validBody.withdrawal({ amount: 1 }));

      expect(res.body.status).toBe("failed");
      expect(res.body.failureReason).toBe("INSUFFICIENT_FUNDS");
    });

    it("FR-1.7 funds are checked in arrival order, whatever timestamps were supplied", async () => {
      await postTransaction(
        validBody.deposit({ amount: 20, timestamp: "2024-02-01T00:00:00Z" }),
      );
      const res = await postTransaction(
        validBody.withdrawal({ amount: 20, timestamp: "2024-01-01T00:00:00Z" }),
      );

      expect(res.body.status).toBe("completed");
    });

    it("FR-1.7 a deposit is always completed", async () => {
      const res = await postTransaction(validBody.deposit());

      expect(res.body.status).toBe("completed");
      expect(res.body).not.toHaveProperty("failureReason");
    });
  });

  describe("UF-2 specification sample flow", () => {
    const sampleTransfer = {
      fromAccount: A,
      toAccount: B,
      amount: 100.5,
      currency: "USD",
      type: "transfer",
    };

    it("UF-2 after funding ACC-12345 the sample transfer completes and balances add up", async () => {
      await postTransaction(
        validBody.deposit({ amount: 1000, timestamp: "2024-01-05T09:00:00Z" }),
      );

      const transfer = await postTransaction(sampleTransfer);
      expect(transfer.status).toBe(201);
      expect(transfer.body.status).toBe("completed");

      const all = await request(app).get("/transactions");
      expect(all.status).toBe(200);
      expect(all.body).toHaveLength(2);

      const balance = await getBalance(A);
      expect(balance.status).toBe(200);
      expect(balance.body).toEqual({ accountId: A, balance: { USD: 899.5 } });
    });

    it("UF-2 on an empty system the sample transfer is recorded as failed", async () => {
      const res = await postTransaction(sampleTransfer);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("failed");
      expect(res.body.failureReason).toBe("INSUFFICIENT_FUNDS");
      expect((await getBalance(A)).body.balance).toEqual({});
    });
  });
});
