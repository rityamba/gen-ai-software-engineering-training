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
