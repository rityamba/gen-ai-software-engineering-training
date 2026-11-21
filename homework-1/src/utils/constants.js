"use strict";

/** Transaction types (FR-4.4). */
const TYPES = Object.freeze(["deposit", "withdrawal", "transfer"]);

/** Transaction statuses (FR-1.4). `pending` exists in the model but is never assigned. */
const STATUSES = Object.freeze(["pending", "completed", "failed"]);

/** Machine-readable reasons for a `failed` transaction (FR-1.7, D2). */
const FAILURE_REASONS = Object.freeze({
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
});

/** `ACC-` + 5 letters or digits, case-sensitive (FR-4.2, D14). */
const ACCOUNT_REGEX = /^ACC-[A-Za-z0-9]{5}$/;

/** The only fields a client may send in POST /transactions, in error-report order (D16, §6.7). */
const ALLOWED_FIELDS = Object.freeze([
  "fromAccount",
  "toAccount",
  "amount",
  "currency",
  "type",
  "timestamp",
]);

/** Fields the server sets; a client sending them gets a dedicated message (FR-1.2, FR-1.4). */
const SERVER_FIELDS = Object.freeze(["id", "status", "failureReason"]);

/**
 * Supported ISO 4217 codes: popular, currently active currencies (D18, AD-7).
 * Last reviewed: 2026-11-21.
 */
const CURRENCIES = Object.freeze([
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
]);

module.exports = {
  TYPES,
  STATUSES,
  FAILURE_REASONS,
  ACCOUNT_REGEX,
  ALLOWED_FIELDS,
  SERVER_FIELDS,
  CURRENCIES,
};
