"use strict";

const accountService = require("../../src/services/accountService");
const transactionService = require("../../src/services/transactionService");
const store = require("../../src/store/transactionStore");
const { validBody } = require("../helpers/transactions");

const A = "ACC-12345";
const B = "ACC-67890";

describe("accountService", () => {
  beforeEach(() => store.reset());

  describe("getBalance", () => {
    it("FR-3.4 an account with no transactions has an empty balance", () => {
      expect(accountService.getBalance(A)).toEqual({
        accountId: A,
        balance: {},
      });
    });

    it("FR-3.2 deposits add, withdrawals subtract, transfers move between accounts", () => {
      transactionService.create(validBody.deposit({ amount: 200 }));
      transactionService.create(validBody.transfer({ amount: 50.25 }));
      transactionService.create(validBody.withdrawal({ amount: 20 }));

      expect(accountService.getBalance(A).balance).toEqual({ USD: 129.75 });
      expect(accountService.getBalance(B).balance).toEqual({ USD: 50.25 });
    });

    it("FR-3.3 reports each currency separately and never adds them together", () => {
      transactionService.create(validBody.deposit({ amount: 100 }));
      transactionService.create(
        validBody.deposit({ amount: 30, currency: "EUR" }),
      );

      expect(accountService.getBalance(A).balance).toEqual({
        USD: 100,
        EUR: 30,
      });
    });

    it("§6.4 a currency with a net zero stays visible as 0", () => {
      transactionService.create(validBody.deposit({ amount: 20 }));
      transactionService.create(validBody.withdrawal({ amount: 20 }));

      expect(accountService.getBalance(A).balance).toEqual({ USD: 0 });
    });

    it("D2 failed transactions do not count towards the balance", () => {
      transactionService.create(validBody.deposit({ amount: 10 }));
      const failed = transactionService.create(
        validBody.transfer({ amount: 50 }),
      );

      expect(failed.status).toBe("failed");
      expect(accountService.getBalance(A).balance).toEqual({ USD: 10 });
      expect(accountService.getBalance(B).balance).toEqual({});
    });

    it("AD-4 sums in hundredths, so 0.1 + 0.2 is exactly 0.3", () => {
      transactionService.create(validBody.deposit({ amount: 0.1 }));
      transactionService.create(validBody.deposit({ amount: 0.2 }));

      expect(accountService.getBalance(A).balance).toEqual({ USD: 0.3 });
    });

    it("FR-3.2 other accounts' transactions are ignored", () => {
      transactionService.create(validBody.deposit({ toAccount: B }));

      expect(accountService.getBalance(A).balance).toEqual({});
    });
  });

  describe("availableMinor", () => {
    it("FR-1.7 returns hundredths for the currency and 0 for an unused one", () => {
      transactionService.create(validBody.deposit({ amount: 12.34 }));

      expect(accountService.availableMinor(A, "USD")).toBe(1234);
      expect(accountService.availableMinor(A, "EUR")).toBe(0);
    });
  });
});

describe("accountService.getSummary (FR-6)", () => {
  beforeEach(() => store.reset());

  it("FR-6.5 an account with no transactions has empty totals, zero counts and no date", () => {
    expect(accountService.getSummary(A)).toEqual({
      accountId: A,
      totalDeposits: {},
      totalWithdrawals: {},
      transactionCount: 0,
      failedCount: 0,
      mostRecentTransactionDate: null,
    });
  });

  it("FR-6.4 an incoming transfer is a deposit and an outgoing one a withdrawal", () => {
    transactionService.create(validBody.deposit({ amount: 200 }));
    transactionService.create(validBody.transfer({ amount: 50.25 }));

    expect(accountService.getSummary(A)).toMatchObject({
      totalDeposits: { USD: 200 },
      totalWithdrawals: { USD: 50.25 },
    });
    expect(accountService.getSummary(B)).toMatchObject({
      totalDeposits: { USD: 50.25 },
      totalWithdrawals: { USD: 0 },
    });
  });

  it("FR-6.3 both totals list the balance's currencies, with 0 for a side without movement", () => {
    transactionService.create(validBody.deposit({ amount: 10 }));
    transactionService.create(
      validBody.deposit({ amount: 30, currency: "EUR" }),
    );
    transactionService.create(
      validBody.withdrawal({ amount: 5, currency: "EUR" }),
    );

    const summary = accountService.getSummary(A);
    expect(summary.totalDeposits).toEqual({ USD: 10, EUR: 30 });
    expect(summary.totalWithdrawals).toEqual({ USD: 0, EUR: 5 });
    expect(Object.keys(summary.totalDeposits)).toEqual(
      Object.keys(accountService.getBalance(A).balance),
    );
  });

  it("D2 failed transactions are counted but not totalled", () => {
    transactionService.create(validBody.deposit({ amount: 10 }));
    transactionService.create(validBody.withdrawal({ amount: 50 })); // failed
    transactionService.create(
      validBody.withdrawal({ amount: 1, currency: "GBP" }),
    ); // failed, currency never completed

    expect(accountService.getSummary(A)).toMatchObject({
      totalDeposits: { USD: 10 },
      totalWithdrawals: { USD: 0 },
      transactionCount: 3,
      failedCount: 2,
    });
  });

  it("D19 the most recent date includes failed transactions and compares instants", () => {
    transactionService.create(
      validBody.deposit({ timestamp: "2024-01-10T00:00:00Z" }),
    );
    // 2024-01-20T01:00+02:00 = 2024-01-19T23:00Z, earlier than the failed one below
    transactionService.create(
      validBody.deposit({ timestamp: "2024-01-20T01:00:00+02:00" }),
    );
    transactionService.create(
      validBody.withdrawal({
        amount: 1_000_000,
        timestamp: "2024-01-19T23:30:00Z",
      }),
    ); // failed

    expect(accountService.getSummary(A).mostRecentTransactionDate).toBe(
      "2024-01-19T23:30:00.000Z",
    );
  });

  it("AD-4 totals are summed in hundredths", () => {
    transactionService.create(validBody.deposit({ amount: 0.1 }));
    transactionService.create(validBody.deposit({ amount: 0.2 }));

    expect(accountService.getSummary(A).totalDeposits).toEqual({ USD: 0.3 });
  });

  it("FR-6.2 other accounts' transactions are not counted", () => {
    transactionService.create(validBody.deposit({ toAccount: B }));

    expect(accountService.getSummary(A).transactionCount).toBe(0);
  });
});
