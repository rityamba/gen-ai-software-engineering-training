"use strict";

const request = require("supertest");
const store = require("../../src/store/transactionStore");
const { app, validBody, postTransaction } = require("../helpers/transactions");

const A = "ACC-12345";
const B = "ACC-67890";

const getSummary = (accountId, query = "") =>
  request(app).get(`/accounts/${accountId}/summary${query}`);
const getBalance = (accountId) =>
  request(app).get(`/accounts/${accountId}/balance`);

/** Mixed history for A: deposits, withdrawals and transfers in and out, two currencies, one failure. */
async function seedMixed() {
  await postTransaction(
    validBody.deposit({ amount: 1000, timestamp: "2024-01-01T09:00:00Z" }),
  );
  await postTransaction(
    validBody.deposit({
      amount: 300,
      currency: "EUR",
      timestamp: "2024-01-02T09:00:00Z",
    }),
  );
  await postTransaction(
    validBody.transfer({ amount: 100.5, timestamp: "2024-01-10T09:00:00Z" }),
  );
  await postTransaction(
    validBody.deposit({
      toAccount: B,
      amount: 40,
      currency: "EUR",
      timestamp: "2024-01-11T09:00:00Z",
    }),
  );
  await postTransaction(
    validBody.transfer({
      fromAccount: B,
      toAccount: A,
      amount: 25.25,
      currency: "EUR",
      timestamp: "2024-01-12T09:00:00Z",
    }),
  );
  await postTransaction(
    validBody.withdrawal({
      amount: 49.5,
      currency: "EUR",
      timestamp: "2024-01-20T09:00:00Z",
    }),
  );
  await postTransaction(
    validBody.withdrawal({ amount: 5000, timestamp: "2024-01-31T12:00:00Z" }),
  ); // failed
}

describe("GET /accounts/:accountId/summary (FR-6)", () => {
  beforeEach(() => store.reset());

  it("FR-6.5/D4 an account with no transactions returns 200 with empty totals", async () => {
    const res = await getSummary(A);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({
      accountId: A,
      totalDeposits: {},
      totalWithdrawals: {},
      transactionCount: 0,
      failedCount: 0,
      mostRecentTransactionDate: null,
    });
  });

  it("FR-6.1 totals, counts and date for a mixed, multi-currency account", async () => {
    await seedMixed();

    const res = await getSummary(A);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      accountId: A,
      totalDeposits: { USD: 1000, EUR: 325.25 },
      totalWithdrawals: { USD: 100.5, EUR: 49.5 },
      transactionCount: 6,
      failedCount: 1,
      mostRecentTransactionDate: "2024-01-31T12:00:00.000Z",
    });
  });

  it("FR-6.4 the other side of the transfers sees them reversed", async () => {
    await seedMixed();

    expect((await getSummary(B)).body).toEqual({
      accountId: B,
      totalDeposits: { USD: 100.5, EUR: 40 },
      totalWithdrawals: { USD: 0, EUR: 25.25 },
      transactionCount: 3,
      failedCount: 0,
      mostRecentTransactionDate: "2024-01-12T09:00:00.000Z",
    });
  });

  it.each([A, B])(
    "FR-6.4/D20 deposits − withdrawals = balance for every currency (%s)",
    async (accountId) => {
      await seedMixed();

      const { totalDeposits, totalWithdrawals } = (await getSummary(accountId))
        .body;
      const { balance } = (await getBalance(accountId)).body;

      expect(Object.keys(totalDeposits)).toEqual(Object.keys(balance));
      expect(Object.keys(totalWithdrawals)).toEqual(Object.keys(balance));
      for (const currency of Object.keys(balance)) {
        expect(
          Math.round(totalDeposits[currency] * 100) -
            Math.round(totalWithdrawals[currency] * 100),
        ).toBe(Math.round(balance[currency] * 100));
      }
    },
  );

  it("FR-6.3 a currency spent to exactly zero keeps both totals and a 0 balance", async () => {
    await postTransaction(validBody.deposit({ amount: 20 }));
    await postTransaction(validBody.withdrawal({ amount: 20 }));

    const summary = (await getSummary(A)).body;
    expect(summary.totalDeposits).toEqual({ USD: 20 });
    expect(summary.totalWithdrawals).toEqual({ USD: 20 });
    expect((await getBalance(A)).body.balance).toEqual({ USD: 0 });
  });

  it("D19 an account with only failed transactions has counts and a date but no totals", async () => {
    await postTransaction(
      validBody.withdrawal({ timestamp: "2024-03-01T00:00:00Z" }),
    );

    expect((await getSummary(A)).body).toEqual({
      accountId: A,
      totalDeposits: {},
      totalWithdrawals: {},
      transactionCount: 1,
      failedCount: 1,
      mostRecentTransactionDate: "2024-03-01T00:00:00.000Z",
    });
  });

  it("D14 a lower-case accountId reads the same account, reported in upper case", async () => {
    await postTransaction(validBody.deposit({ amount: 10 }));

    const res = await getSummary("acc-12345");

    expect(res.status).toBe(200);
    expect(res.body.accountId).toBe(A);
    expect(res.body.totalDeposits).toEqual({ USD: 10 });
  });

  describe("invalid requests (FR-4.2, D16, D22)", () => {
    const ACCOUNT_ERROR = {
      field: "accountId",
      message:
        "Account must match the format ACC-XXXXX, where X is a letter or digit",
    };

    it.each([
      ["wrong prefix", "AC-12345"],
      ["too short", "ACC-1234"],
    ])("FR-4.2 a malformed accountId (%s) gives 400", async (_label, id) => {
      const res = await getSummary(id);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: "Validation failed",
        details: [ACCOUNT_ERROR],
      });
    });

    it("D16 an unknown query parameter gives 400", async () => {
      const res = await getSummary(A, "?currency=USD");

      expect(res.status).toBe(400);
      expect(res.body.details).toEqual([
        { field: "currency", message: 'Unknown query parameter "currency"' },
      ]);
    });

    it("D22 a malformed accountId and a query parameter are reported together", async () => {
      const res = await getSummary("bad", "?x=1");

      expect(res.status).toBe(400);
      expect(res.body.details).toEqual([
        ACCOUNT_ERROR,
        { field: "x", message: 'Unknown query parameter "x"' },
      ]);
    });
  });
});
