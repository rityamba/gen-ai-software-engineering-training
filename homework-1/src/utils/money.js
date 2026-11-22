"use strict";

/**
 * Money is stored as integer hundredths ("minor units") to avoid float errors (AD-4).
 */

/** Largest accepted amount in major units (D11, AD-5). */
const MAX_AMOUNT = 1_000_000_000;

/** Plain decimal with at most 2 fraction digits; also rejects exponent forms like 1e-7. */
const DECIMAL_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Checks an amount from a request body.
 * @param {unknown} value
 * @returns {string|null} an error message, or null when valid
 */
function validateAmount(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Amount must be a number";
  }
  if (value <= 0) {
    return "Amount must be a positive number";
  }
  if (value > MAX_AMOUNT) {
    return `Amount must not exceed ${MAX_AMOUNT}`;
  }
  if (!DECIMAL_REGEX.test(String(value))) {
    return "Amount must have at most 2 decimal places";
  }
  return null;
}

/**
 * Converts a validated amount to integer hundredths. Call only after validateAmount.
 * @param {number} amount
 * @returns {number}
 */
function toMinor(amount) {
  return Math.round(amount * 100);
}

/**
 * Converts integer hundredths back to a major-unit number for responses.
 * @param {number} minor
 * @returns {number}
 */
function fromMinor(minor) {
  return minor / 100;
}

module.exports = { MAX_AMOUNT, validateAmount, toMinor, fromMinor };
