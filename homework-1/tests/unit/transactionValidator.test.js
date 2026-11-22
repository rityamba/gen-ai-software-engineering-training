"use strict";

const {
  validateTransaction,
} = require("../../src/validators/transactionValidator");
const { validBody } = require("../helpers/transactions");

const NOW = new Date("2025-06-01T12:00:00.000Z");
const validate = (body) => validateTransaction(body, { now: NOW });
const fields = (details) => details.map((d) => d.field);
const ACCOUNT_FORMAT =
  "Account must match the format ACC-XXXXX, where X is a letter or digit";
const UNSUPPORTED =
  "Unsupported currency code. Supported: USD, EUR, GBP, JPY, CHF, CAD, AUD, CNY, SEK, NOK, DKK, PLN, CZK, UAH";

describe("transactionValidator", () => {
  describe("body shape (FR-4.7)", () => {
    it.each([undefined, null, [], "text", 42, true])(
      "FR-4.7 rejects a non-object body: %p",
      (body) => {
        expect(validate(body)).toEqual([
          { field: "body", message: "Request body must be a JSON object" },
        ]);
      },
    );
  });

  describe("valid bodies", () => {
    it.each(["deposit", "withdrawal", "transfer"])(
      "FR-1.1 accepts a valid %s",
      (type) => {
        expect(validate(validBody[type]())).toEqual([]);
      },
    );

    it("FR-1.3 accepts a past timestamp with an offset", () => {
      expect(
        validate(validBody.deposit({ timestamp: "2024-01-15T10:30:00+02:00" })),
      ).toEqual([]);
    });

    it("R1 treats null in a forbidden account field as not supplied", () => {
      expect(validate(validBody.deposit({ fromAccount: null }))).toEqual([]);
      expect(validate(validBody.withdrawal({ toAccount: null }))).toEqual([]);
    });

    it.each([
      "USD",
      "EUR",
      "GBP",
      "JPY",
      "CHF",
      "CAD",
      "AUD",
      "CNY",
      "SEK",
      "NOK",
      "DKK",
      "PLN",
      "CZK",
      "UAH",
    ])("D18 accepts supported currency %s", (currency) => {
      expect(validate(validBody.deposit({ currency }))).toEqual([]);
    });

    it("FR-4.1/D17 accepts 2 decimal places in JPY", () => {
      expect(
        validate(validBody.deposit({ currency: "JPY", amount: 10.25 })),
      ).toEqual([]);
    });

    it("D14 treats the 5 account characters as case-sensitive but valid", () => {
      expect(
        validate(
          validBody.transfer({
            fromAccount: "ACC-abcde",
            toAccount: "ACC-ABCDE",
          }),
        ),
      ).toEqual([]);
    });
  });

  describe("account rules per type (FR-1.6)", () => {
    it("FR-1.6 deposit requires toAccount and forbids fromAccount", () => {
      expect(validate(validBody.deposit({ toAccount: undefined }))).toEqual([
        { field: "toAccount", message: "toAccount is required for a deposit" },
      ]);
      expect(validate(validBody.deposit({ fromAccount: "ACC-11111" }))).toEqual(
        [
          {
            field: "fromAccount",
            message: "fromAccount must not be set for a deposit",
          },
        ],
      );
    });

    it("FR-1.6 withdrawal requires fromAccount and forbids toAccount", () => {
      expect(
        validate(validBody.withdrawal({ fromAccount: undefined })),
      ).toEqual([
        {
          field: "fromAccount",
          message: "fromAccount is required for a withdrawal",
        },
      ]);
      expect(
        validate(validBody.withdrawal({ toAccount: "ACC-11111" })),
      ).toEqual([
        {
          field: "toAccount",
          message: "toAccount must not be set for a withdrawal",
        },
      ]);
    });

    it("FR-1.6 transfer requires both accounts", () => {
      expect(
        validate(
          validBody.transfer({ fromAccount: undefined, toAccount: null }),
        ),
      ).toEqual([
        {
          field: "fromAccount",
          message: "fromAccount is required for a transfer",
        },
        { field: "toAccount", message: "toAccount is required for a transfer" },
      ]);
    });

    it("FR-1.6 transfer accounts must differ", () => {
      expect(
        validate(
          validBody.transfer({
            fromAccount: "ACC-12345",
            toAccount: "ACC-12345",
          }),
        ),
      ).toEqual([
        {
          field: "toAccount",
          message: "toAccount must be different from fromAccount",
        },
      ]);
    });

    it("FR-1.6 with an unknown type, only the format of supplied accounts is checked", () => {
      expect(
        validate({
          fromAccount: "bad",
          amount: 1,
          currency: "USD",
          type: "refund",
        }),
      ).toEqual([
        { field: "fromAccount", message: ACCOUNT_FORMAT },
        {
          field: "type",
          message: "Type must be one of: deposit, withdrawal, transfer",
        },
      ]);
    });
  });

  describe("field formats", () => {
    it.each([
      "acc-12345",
      "ACC-1234",
      "ACC-123456",
      "ACC_12345",
      "ACC-12 45",
      "ACC-1234!",
      "",
      12345,
    ])("FR-4.2 rejects malformed account %p", (toAccount) => {
      expect(validate(validBody.deposit({ toAccount }))).toEqual([
        { field: "toAccount", message: ACCOUNT_FORMAT },
      ]);
    });

    it("FR-4.1 requires amount", () => {
      expect(validate(validBody.deposit({ amount: undefined }))).toEqual([
        { field: "amount", message: "Amount is required" },
      ]);
    });

    it.each([
      [0, "Amount must be a positive number"],
      [-5, "Amount must be a positive number"],
      ["100", "Amount must be a number"],
      [100.123, "Amount must have at most 2 decimal places"],
      [1000000000.01, "Amount must not exceed 1000000000"],
    ])("FR-4.1 rejects amount %p", (amount, message) => {
      expect(validate(validBody.deposit({ amount }))).toEqual([
        { field: "amount", message },
      ]);
    });

    it("FR-4.3 requires currency", () => {
      expect(validate(validBody.deposit({ currency: undefined }))).toEqual([
        { field: "currency", message: "Currency is required" },
      ]);
    });

    it.each(["usd", "XXX", "XAU", "XTS", "DEM", "ABC", "US", "", 840, null])(
      "D18/AD-7 rejects currency %p as unsupported",
      (currency) => {
        expect(validate(validBody.deposit({ currency }))).toEqual([
          { field: "currency", message: UNSUPPORTED },
        ]);
      },
    );

    it("FR-4.4 requires type", () => {
      const details = validate({
        toAccount: "ACC-12345",
        amount: 1,
        currency: "USD",
      });
      expect(details).toEqual([{ field: "type", message: "Type is required" }]);
    });

    it.each(["refund", "Deposit", "", null])(
      "FR-4.4 rejects type %p",
      (type) => {
        expect(validate(validBody.deposit({ type }))).toContainEqual({
          field: "type",
          message: "Type must be one of: deposit, withdrawal, transfer",
        });
      },
    );

    it.each([
      ["2024-01-15T10:30:00", "a timestamp without timezone"],
      ["2024-02-30T10:30:00Z", "an impossible date"],
      [null, "null"],
      [1705314600000, "a number"],
    ])("FR-4.5 rejects %p (%s)", (timestamp) => {
      expect(fields(validate(validBody.deposit({ timestamp })))).toEqual([
        "timestamp",
      ]);
    });

    it("FR-4.5 rejects a future timestamp", () => {
      expect(
        validate(validBody.deposit({ timestamp: "2025-06-01T12:00:01Z" })),
      ).toEqual([
        { field: "timestamp", message: "Timestamp must not be in the future" },
      ]);
    });
  });

  describe("unknown and server-set fields (D16, FR-1.2, FR-1.4)", () => {
    it.each(["id", "status", "failureReason"])(
      "FR-1.2/FR-1.4 rejects client-sent %s",
      (field) => {
        expect(validate(validBody.deposit({ [field]: "x" }))).toEqual([
          {
            field,
            message: `${field} is set by the server and must not be sent`,
          },
        ]);
      },
    );

    it("D16 rejects an unknown field", () => {
      expect(validate(validBody.deposit({ note: "hi" }))).toEqual([
        { field: "note", message: 'Unknown field "note"' },
      ]);
    });

    it("§9 rejects __proto__ and constructor from parsed JSON", () => {
      const body = JSON.parse(
        '{"toAccount":"ACC-12345","amount":1,"currency":"USD","type":"deposit","__proto__":{"x":1},"constructor":1}',
      );
      expect(fields(validate(body))).toEqual(["__proto__", "constructor"]);
    });
  });

  describe("collect all errors (FR-4.6)", () => {
    it("FR-4.6 reports every problem at once, in field order", () => {
      const details = validate({
        fromAccount: "ACC-1",
        toAccount: "acc-67890",
        amount: -1,
        currency: "usd",
        type: "transfer",
        timestamp: "2999-01-01T00:00:00Z",
        status: "completed",
        extra: true,
      });
      expect(fields(details)).toEqual([
        "fromAccount",
        "toAccount",
        "amount",
        "currency",
        "timestamp",
        "status",
        "extra",
      ]);
    });

    it("FR-4.6 an empty object reports every required field", () => {
      expect(fields(validate({}))).toEqual(["amount", "currency", "type"]);
    });
  });
});
