"use strict";

const {
  TYPES,
  ACCOUNT_REGEX,
  ACCOUNT_FORMAT_MESSAGE,
  ALLOWED_FIELDS,
  SERVER_FIELDS,
  CURRENCIES,
} = require("../utils/constants");
const { validateAmount } = require("../utils/money");
const { validateTimestamp } = require("../utils/dates");

/**
 * Which account fields each type needs (FR-1.6).
 * An unknown type gives no requirement, so only the format of supplied accounts is checked.
 */
const ACCOUNT_RULES = {
  deposit: { fromAccount: "forbidden", toAccount: "required" },
  withdrawal: { fromAccount: "required", toAccount: "forbidden" },
  transfer: { fromAccount: "required", toAccount: "required" },
};

/** `null` counts as "not supplied", so a response body can be sent back unchanged. */
function isPresent(value) {
  return value !== undefined && value !== null;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateAccounts(body, details) {
  const rules = ACCOUNT_RULES[body.type] || {};
  const valid = {};

  for (const field of ["fromAccount", "toAccount"]) {
    const value = body[field];
    const rule = rules[field];

    if (!isPresent(value)) {
      if (rule === "required") {
        details.push({
          field,
          message: `${field} is required for a ${body.type}`,
        });
      }
      continue;
    }
    if (rule === "forbidden") {
      details.push({
        field,
        message: `${field} must not be set for a ${body.type}`,
      });
      continue;
    }
    if (typeof value !== "string" || !ACCOUNT_REGEX.test(value)) {
      details.push({ field, message: ACCOUNT_FORMAT_MESSAGE });
      continue;
    }
    valid[field] = value;
  }

  if (
    body.type === "transfer" &&
    valid.fromAccount !== undefined &&
    valid.fromAccount === valid.toAccount
  ) {
    details.push({
      field: "toAccount",
      message: "toAccount must be different from fromAccount",
    });
  }
}

function validateCurrency(value) {
  if (value === undefined) return "Currency is required";
  if (typeof value !== "string" || !CURRENCIES.includes(value)) {
    return `Unsupported currency code. Supported: ${CURRENCIES.join(", ")}`;
  }
  return null;
}

function validateType(value) {
  if (value === undefined) return "Type is required";
  if (!TYPES.includes(value)) return `Type must be one of: ${TYPES.join(", ")}`;
  return null;
}

/**
 * Validates a POST /transactions body. Pure: never reads the store.
 * Reports every problem at once, in field order, then unknown fields (FR-4.6, §6.7).
 * @param {unknown} body
 * @param {{now?: Date}} [options]
 * @returns {{field: string, message: string}[]} empty when the body is valid
 */
function validateTransaction(body, { now = new Date() } = {}) {
  if (!isPlainObject(body)) {
    return [{ field: "body", message: "Request body must be a JSON object" }];
  }

  const details = [];
  validateAccounts(body, details);

  const add = (field, message) => {
    if (message) details.push({ field, message });
  };
  add(
    "amount",
    body.amount === undefined
      ? "Amount is required"
      : validateAmount(body.amount),
  );
  add("currency", validateCurrency(body.currency));
  add("type", validateType(body.type));
  if (body.timestamp !== undefined) {
    add("timestamp", validateTimestamp(body.timestamp, now));
  }

  for (const field of Object.keys(body)) {
    if (ALLOWED_FIELDS.includes(field)) continue;
    add(
      field,
      SERVER_FIELDS.includes(field)
        ? `${field} is set by the server and must not be sent`
        : `Unknown field "${field}"`,
    );
  }

  return details;
}

module.exports = { validateTransaction };
