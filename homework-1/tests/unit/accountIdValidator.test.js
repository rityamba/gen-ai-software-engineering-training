"use strict";

const {
  validateAccountId,
} = require("../../src/validators/accountIdValidator");

const ERROR = [
  {
    field: "accountId",
    message:
      "Account must match the format ACC-XXXXX, where X is a letter or digit",
  },
];

describe("accountIdValidator (FR-4.2, D22)", () => {
  it.each(["ACC-12345", "ACC-abcde", "ACC-A1b2C"])(
    "FR-4.2 accepts %s",
    (id) => {
      expect(validateAccountId(id)).toEqual([]);
    },
  );

  it.each([
    ["lower-case prefix (D14)", "acc-12345"],
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
});
