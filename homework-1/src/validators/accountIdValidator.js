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

module.exports = { validateAccountId };
