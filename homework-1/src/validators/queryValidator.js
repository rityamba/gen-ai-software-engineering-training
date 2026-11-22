"use strict";

const {
  TYPES,
  TYPE_MESSAGE,
  STATUSES,
  ACCOUNT_REGEX,
  ACCOUNT_FORMAT_MESSAGE,
  unknownQueryParamMessage,
  TRANSACTION_QUERY_PARAMS,
} = require("../utils/constants");
const { parseDateFilter } = require("../utils/dates");
const { normalizeAccountId } = require("./accountIdValidator");

const INVALID_DATE_MESSAGE =
  "Invalid date. Use YYYY-MM-DD or an ISO 8601 date-time with a timezone, e.g. 2024-01-15T10:30:00Z";

/** An unencoded "+" in a query string decodes to a space (AD-6). */
const PLUS_AS_SPACE_MESSAGE =
  'Invalid date. Encode "+" in an offset as %2B, or use Z';

/** `…T10:30:00 02:00`: what `+02:00` becomes when the client did not encode it. */
const PLUS_AS_SPACE_REGEX = /T[\d:.]+ \d{2}:\d{2}$/;

function checkDate(field, value, boundary, details) {
  const date = parseDateFilter(value, boundary);
  if (date) return date;
  details.push({
    field,
    message: PLUS_AS_SPACE_REGEX.test(value)
      ? PLUS_AS_SPACE_MESSAGE
      : INVALID_DATE_MESSAGE,
  });
  return null;
}

/**
 * Validates and parses the GET /transactions query (FR-5.5, FR-5.6, D12, D16, D21, §6.2).
 * Pure: never reads the store. Reports every problem at once: allowed parameters in
 * TRANSACTION_QUERY_PARAMS order, then "from" later than "to", then unknown parameters.
 * @param {Object<string, string|string[]>} query `req.query` from the simple parser
 * @returns {{details: {field: string, message: string}[], filters: object}}
 *   `filters` holds `accountId`, `type`, `status` (strings) and `from`, `to` (Dates)
 *   for the parameters that were supplied; use it only when `details` is empty.
 */
function validateTransactionQuery(query) {
  const details = [];
  const filters = {};

  for (const field of TRANSACTION_QUERY_PARAMS) {
    const value = query[field];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      details.push({
        field,
        message: `Query parameter "${field}" must appear at most once`,
      });
      continue;
    }
    if (value === "") {
      details.push({
        field,
        message: `Query parameter "${field}" must not be empty`,
      });
      continue;
    }

    if (field === "accountId") {
      if (ACCOUNT_REGEX.test(value))
        filters.accountId = normalizeAccountId(value);
      else details.push({ field, message: ACCOUNT_FORMAT_MESSAGE });
    } else if (field === "type") {
      if (TYPES.includes(value)) filters.type = value;
      else details.push({ field, message: TYPE_MESSAGE });
    } else if (field === "status") {
      if (STATUSES.includes(value)) filters.status = value;
      else
        details.push({
          field,
          message: `Status must be one of: ${STATUSES.join(", ")}`,
        });
    } else {
      const date = checkDate(
        field,
        value,
        field === "from" ? "start" : "end",
        details,
      );
      if (date) filters[field] = date;
    }
  }

  if (filters.from && filters.to && filters.from > filters.to) {
    details.push({
      field: "from",
      message: '"from" must not be later than "to"',
    });
  }

  for (const field of Object.keys(query)) {
    if (!TRANSACTION_QUERY_PARAMS.includes(field)) {
      details.push({ field, message: unknownQueryParamMessage(field) });
    }
  }

  return { details, filters };
}

module.exports = { validateTransactionQuery };
