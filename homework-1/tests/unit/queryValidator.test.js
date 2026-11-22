"use strict";

const {
  validateTransactionQuery,
} = require("../../src/validators/queryValidator");

const ACCOUNT_MESSAGE =
  "Account must match the format ACC-XXXXX, where X is a letter or digit";
const INVALID_DATE =
  "Invalid date. Use YYYY-MM-DD or an ISO 8601 date-time with a timezone, e.g. 2024-01-15T10:30:00Z";

describe("queryValidator (FR-5.5, FR-5.6, D12, D16, D21)", () => {
  it("FR-2.1 an empty query is valid and has no filters", () => {
    expect(validateTransactionQuery({})).toEqual({ details: [], filters: {} });
  });

  it("FR-5 parses every supported filter", () => {
    const { details, filters } = validateTransactionQuery({
      accountId: "ACC-12345",
      type: "transfer",
      status: "failed",
      from: "2024-01-01",
      to: "2024-01-31",
    });

    expect(details).toEqual([]);
    expect(filters).toEqual({
      accountId: "ACC-12345",
      type: "transfer",
      status: "failed",
      from: new Date("2024-01-01T00:00:00.000Z"),
      to: new Date("2024-01-31T23:59:59.999Z"),
    });
  });

  it("D21 accepts full date-times with an offset", () => {
    const { details, filters } = validateTransactionQuery({
      from: "2024-01-15T10:30:00+02:00",
      to: "2024-01-15T10:30:00Z",
    });

    expect(details).toEqual([]);
    expect(filters.from.toISOString()).toBe("2024-01-15T08:30:00.000Z");
    expect(filters.to.toISOString()).toBe("2024-01-15T10:30:00.000Z");
  });

  it("D21 allows dates in the future", () => {
    expect(validateTransactionQuery({ to: "2099-01-01" }).details).toEqual([]);
  });

  it("FR-5.7 accepts pending as a status even though it is never assigned", () => {
    expect(validateTransactionQuery({ status: "pending" }).details).toEqual([]);
  });

  it.each([
    ["accountId", "acc-1234", ACCOUNT_MESSAGE],
    ["type", "refund", "Type must be one of: deposit, withdrawal, transfer"],
    ["type", "Transfer", "Type must be one of: deposit, withdrawal, transfer"],
    ["status", "done", "Status must be one of: pending, completed, failed"],
    ["from", "2024-02-30", INVALID_DATE],
    ["from", "2024-01-15T10:30:00", INVALID_DATE],
    ["to", "15/01/2024", INVALID_DATE],
    ["to", "2024-1-5", INVALID_DATE],
  ])("FR-5.5 rejects %s=%s", (field, value, message) => {
    expect(validateTransactionQuery({ [field]: value }).details).toEqual([
      { field, message },
    ]);
  });

  it('AD-6 explains an unencoded "+" offset that arrived as a space', () => {
    expect(
      validateTransactionQuery({ from: "2024-01-15T10:30:00 02:00" }).details,
    ).toEqual([
      {
        field: "from",
        message: 'Invalid date. Encode "+" in an offset as %2B, or use Z',
      },
    ]);
  });

  it("D16 rejects a repeated parameter", () => {
    expect(
      validateTransactionQuery({ type: ["deposit", "transfer"] }).details,
    ).toEqual([
      {
        field: "type",
        message: 'Query parameter "type" must appear at most once',
      },
    ]);
  });

  it("D16 rejects an empty value", () => {
    expect(validateTransactionQuery({ accountId: "" }).details).toEqual([
      {
        field: "accountId",
        message: 'Query parameter "accountId" must not be empty',
      },
    ]);
  });

  it("D16 rejects an unknown parameter, e.g. a typo", () => {
    expect(validateTransactionQuery({ tpye: "transfer" }).details).toEqual([
      { field: "tpye", message: 'Unknown query parameter "tpye"' },
    ]);
  });

  it('FR-5.5 rejects "from" later than "to"', () => {
    expect(
      validateTransactionQuery({ from: "2024-02-01", to: "2024-01-31" })
        .details,
    ).toEqual([
      { field: "from", message: '"from" must not be later than "to"' },
    ]);
  });

  it("D21 from and to on the same date-only day is a valid range", () => {
    expect(
      validateTransactionQuery({ from: "2024-01-31", to: "2024-01-31" })
        .details,
    ).toEqual([]);
  });

  it("D21 a date-time later the same day is still before a date-only to", () => {
    expect(
      validateTransactionQuery({
        from: "2024-01-31T23:00:00Z",
        to: "2024-01-31",
      }).details,
    ).toEqual([]);
  });

  it("FR-4.6 reports every problem at once, in parameter order, unknown last", () => {
    const { details } = validateTransactionQuery({
      foo: "1",
      to: "nope",
      type: "refund",
      accountId: "ACC-1",
    });

    expect(details.map((d) => d.field)).toEqual([
      "accountId",
      "type",
      "to",
      "foo",
    ]);
  });

  it('FR-5.5 skips the range check when "from" or "to" is itself invalid', () => {
    expect(
      validateTransactionQuery({ from: "2024-02-01", to: "bad" }).details,
    ).toEqual([{ field: "to", message: INVALID_DATE }]);
  });
});
