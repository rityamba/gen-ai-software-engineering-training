"use strict";

const {
  MAX_AMOUNT,
  validateAmount,
  toMinor,
  fromMinor,
} = require("../../src/utils/money");

describe("money (AD-4, AD-5)", () => {
  it.each([1, 0.01, 100.5, 100.55, 1.15, 999999999.99, MAX_AMOUNT])(
    "FR-4.1 accepts %p",
    (amount) => {
      expect(validateAmount(amount)).toBeNull();
    },
  );

  it.each(["100", null, true, {}, [], NaN, Infinity, -Infinity])(
    "FR-4.7 rejects non-number %p",
    (amount) => {
      expect(validateAmount(amount)).toBe("Amount must be a number");
    },
  );

  it.each([0, -0, -1, -0.01])("FR-4.1 rejects non-positive %p", (amount) => {
    expect(validateAmount(amount)).toBe("Amount must be a positive number");
  });

  it.each([100.123, 0.001, 1e-7])(
    "FR-4.1 rejects more than 2 decimal places: %p",
    (amount) => {
      expect(validateAmount(amount)).toBe(
        "Amount must have at most 2 decimal places",
      );
    },
  );

  it.each([1000000000.01, 1e21])(
    "D11/AD-5 rejects above the maximum: %p",
    (amount) => {
      expect(validateAmount(amount)).toBe("Amount must not exceed 1000000000");
    },
  );

  it("AD-4 converts to integer hundredths without float artefacts", () => {
    expect(toMinor(1.15)).toBe(115);
    expect(toMinor(0.1) + toMinor(0.2)).toBe(toMinor(0.3));
    expect(toMinor(100.5)).toBe(10050);
    expect(toMinor(1000000000)).toBe(100000000000);
  });

  it("AD-4 converts hundredths back to major units", () => {
    expect(fromMinor(10050)).toBe(100.5);
    expect(fromMinor(115)).toBe(1.15);
    expect(fromMinor(toMinor(0.1) + toMinor(0.2))).toBe(0.3);
  });
});
