"use strict";

const { randomUUID } = require("node:crypto");
const store = require("../store/transactionStore");
const { toMinor, fromMinor } = require("../utils/money");
const { parseIsoDateTime } = require("../utils/dates");
const { FAILURE_REASONS } = require("../utils/constants");
const { availableMinor } = require("./accountService");

/**
 * Public representation (§5.2): amount in major units, both account fields always
 * present (null where not applicable, R1), `seq` and `amountMinor` hidden,
 * `failureReason` only on failed transactions.
 */
function toPublic(record) {
  const result = {
    id: record.id,
    fromAccount: record.fromAccount,
    toAccount: record.toAccount,
    amount: fromMinor(record.amountMinor),
    currency: record.currency,
    type: record.type,
    timestamp: record.timestamp,
    status: record.status,
  };
  if (record.failureReason) result.failureReason = record.failureReason;
  return result;
}

/** Newest first by timestamp, then by creation order (D10, AD-8). */
function compareNewestFirst(a, b) {
  if (a.timestamp !== b.timestamp) return a.timestamp < b.timestamp ? 1 : -1;
  return b.seq - a.seq;
}

/**
 * Status rules (FR-1.7, D2): a deposit always completes. A withdrawal or transfer
 * completes only if the source account holds enough in that currency, checked
 * against completed transactions at processing time, whatever timestamp was supplied.
 * @returns {{status: string, failureReason?: string}}
 */
function decideStatus(type, fromAccount, currency, amountMinor) {
  if (type === "deposit") return { status: "completed" };
  if (availableMinor(fromAccount, currency) >= amountMinor) {
    return { status: "completed" };
  }
  return {
    status: "failed",
    failureReason: FAILURE_REASONS.INSUFFICIENT_FUNDS,
  };
}

/**
 * Creates a transaction from an already validated body (FR-1). An insufficient-funds
 * transaction is still stored, as `failed` (FR-1.7).
 * @param {object} input a body that passed validateTransaction
 * @param {{now?: Date}} [options]
 * @returns {object} the public representation
 */
function create(input, { now = new Date() } = {}) {
  const timestamp =
    input.timestamp === undefined ? now : parseIsoDateTime(input.timestamp);
  const fromAccount = input.fromAccount ?? null;
  const amountMinor = toMinor(input.amount);

  const record = store.add({
    id: randomUUID(),
    fromAccount,
    toAccount: input.toAccount ?? null,
    amountMinor,
    currency: input.currency,
    type: input.type,
    timestamp: timestamp.toISOString(),
    ...decideStatus(input.type, fromAccount, input.currency, amountMinor),
  });
  return toPublic(record);
}

/** @returns {object[]} all transactions, newest first (FR-2.1, FR-2.3). */
function list() {
  return store.getAll().sort(compareNewestFirst).map(toPublic);
}

/** @returns {object|null} the transaction, or null when unknown (FR-2.2). */
function getById(id) {
  const record = store.getById(id);
  return record ? toPublic(record) : null;
}

module.exports = { create, list, getById };
