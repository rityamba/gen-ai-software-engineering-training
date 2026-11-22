"use strict";

const {
  validateAccountId,
  normalizeAccountId,
} = require("../../src/validators/accountIdValidator");

const ERROR = [
  {
    field: "accountId",
    message:
      "Account must match the format ACC-XXXXX, where X is a letter or digit",
  },
];

describe("accountIdValidator (FR-4.2, D22)", () => {
  it.each(["ACC-12345", "ACC-abcde", "ACC-A1b2C", "acc-12345", "Acc-ab12C"])(
    "FR-4.2/D14 accepts %s",
    (id) => {
      expect(validateAccountId(id)).toEqual([]);
    },
  );

  it.each([
    ["wrong prefix", "ACCT-1234"],
    ["too short", "ACC-1234"],
    ["too long", "ACC-123456"],
    ["non-alphanumeric", "ACC-12_45"],
    ["missing prefix", "12345"],
    ["empty", ""],
  ])("FR-4.2 rejects %s", (_label, id) => {
    expect(validateAccountId(id)).toEqual(ERROR);
  });

  it("FR-4.2 rejects a non-string value", () => {
    expect(validateAccountId(undefined)).toEqual(ERROR);
  });

  it.each([
    ["acc-ab12c", "ACC-AB12C"],
    ["Acc-12345", "ACC-12345"],
    ["ACC-XYZ99", "ACC-XYZ99"],
  ])("D14 normalizes %s to %s", (id, expected) => {
    expect(normalizeAccountId(id)).toBe(expected);
  });
});
