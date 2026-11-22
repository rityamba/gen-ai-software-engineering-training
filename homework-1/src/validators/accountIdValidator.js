"use strict";

const { ACCOUNT_REGEX, ACCOUNT_FORMAT_MESSAGE } = require("../utils/constants");

/**
 * Validates the `:accountId` path parameter (FR-4.2, D22). Pure, like the body validator.
 * @param {unknown} accountId
 * @returns {{field: string, message: string}[]} empty when the id is valid
 */
function validateAccountId(accountId) {
  if (typeof accountId === "string" && ACCOUNT_REGEX.test(accountId)) return [];
  return [{ field: "accountId", message: ACCOUNT_FORMAT_MESSAGE }];
}

/**
 * The stored form of an account id: upper case, so `acc-ab12c` and `ACC-AB12C` are the
 * same account (D14). Call only on an id that matched ACCOUNT_REGEX, which is ASCII-only,
 * so upper-casing cannot change its length or format.
 * @param {string} accountId
 * @returns {string}
 */
function normalizeAccountId(accountId) {
  return accountId.toUpperCase();
}

module.exports = { validateAccountId, normalizeAccountId };
