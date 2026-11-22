"use strict";

const store = require("../store/transactionStore");
const { fromMinor } = require("../utils/money");

/**
 * Account balances are derived from stored transactions on every call, never kept
 * as separate state (AD-8). Only `completed` transactions count (FR-3.2, D2).
 */

/**
 * How a completed transaction moves money for one account, in hundredths.
 * @returns {number|null} the signed change, or null when the account is not involved
 */
function movementFor(record, accountId) {
  if (record.status !== "completed") return null;
  if (record.toAccount === accountId) return record.amountMinor;
  if (record.fromAccount === accountId) return -record.amountMinor;
  return null;
}

/**
 * Per-currency balance in hundredths (FR-3.3, D3). A currency appears once the account
 * has any completed transaction in it, so a net zero stays visible as 0 (§6.4).
 * Key order follows the first transaction in each currency.
 * @param {string} accountId
 * @returns {Map<string, number>}
 */
function balanceMinorByCurrency(accountId) {
  const balances = new Map();
  for (const record of store.getAll()) {
    const change = movementFor(record, accountId);
    if (change === null) continue;
    balances.set(
      record.currency,
      (balances.get(record.currency) ?? 0) + change,
    );
  }
  return balances;
}

/** Oldest first by timestamp, then by creation order (AD-8). */
function compareOldestFirst(a, b) {
  if (a.timestamp !== b.timestamp) return a.timestamp < b.timestamp ? -1 : 1;
  return a.seq - b.seq;
}

/**
 * Funds available for a withdrawal or transfer dated `timestamp` (FR-1.7, D2), in
 * hundredths. Other currencies never count.
 *
 * The new debit is placed in the account's history by its timestamp, after any existing
 * transaction with the same timestamp (it is created last). It may spend at most:
 * - the balance at that moment, and
 * - the lowest balance at any later moment, since every later balance drops by the same
 *   amount and none may go below zero.
 * Without a backdated timestamp nothing is later, so this is simply the current balance.
 * @param {string} accountId
 * @param {string} currency
 * @param {string} timestamp ISO 8601 in UTC, as produced by Date#toISOString
 * @returns {number} hundredths
 */
function availableMinor(accountId, currency, timestamp) {
  const history = store
    .getAll()
    .filter((record) => record.currency === currency)
    .sort(compareOldestFirst);

  let running = 0;
  let available = 0;
  let later = false;
  for (const record of history) {
    const change = movementFor(record, accountId);
    if (change === null) continue;
    running += change;
    // Both are toISOString output, so string order is time order.
    if (!later && record.timestamp > timestamp) later = true;
    available = later ? Math.min(available, running) : running;
  }
  return available;
}

/**
 * GET /accounts/:accountId/balance (FR-3, §6.4). An account with no completed
 * transactions has an empty balance, not a 404 (FR-3.4, D4).
 * @param {string} accountId an id that passed validateAccountId
 * @returns {{accountId: string, balance: Object<string, number>}}
 */
function getBalance(accountId) {
  const balance = {};
  for (const [currency, minor] of balanceMinorByCurrency(accountId)) {
    balance[currency] = fromMinor(minor);
  }
  return { accountId, balance };
}

/** @returns {boolean} whether the account is either side of the transaction */
function involves(record, accountId) {
  return record.fromAccount === accountId || record.toAccount === accountId;
}

/**
 * GET /accounts/:accountId/summary (FR-6, §6.5).
 * - Totals: completed transactions only, per currency, in hundredths until the end.
 *   An incoming transfer is a deposit and an outgoing one a withdrawal, so for each
 *   currency deposits − withdrawals = balance (FR-6.4, D20).
 * - Both totals have the balance's currency keys, with 0 for a side without movement (FR-6.3).
 * - Count, failed count and most recent date cover all of the account's transactions,
 *   failed ones included (FR-6.2, D19). No transactions gives {}, {}, 0, 0, null (D4).
 * @param {string} accountId an id that passed validateAccountId
 */
function getSummary(accountId) {
  const deposits = new Map();
  const withdrawals = new Map();
  let transactionCount = 0;
  let failedCount = 0;
  let mostRecent = null;

  for (const record of store.getAll()) {
    if (!involves(record, accountId)) continue;
    transactionCount += 1;
    if (record.status === "failed") failedCount += 1;
    if (
      mostRecent === null ||
      Date.parse(record.timestamp) > Date.parse(mostRecent)
    ) {
      mostRecent = record.timestamp;
    }

    const change = movementFor(record, accountId);
    if (change === null) continue;
    // Register the currency on both sides, in first-seen order like the balance.
    if (!deposits.has(record.currency)) {
      deposits.set(record.currency, 0);
      withdrawals.set(record.currency, 0);
    }
    if (change > 0) {
      deposits.set(record.currency, deposits.get(record.currency) + change);
    } else {
      withdrawals.set(
        record.currency,
        withdrawals.get(record.currency) - change,
      );
    }
  }

  const toMajor = (map) =>
    Object.fromEntries(
      [...map].map(([currency, minor]) => [currency, fromMinor(minor)]),
    );

  return {
    accountId,
    totalDeposits: toMajor(deposits),
    totalWithdrawals: toMajor(withdrawals),
    transactionCount,
    failedCount,
    mostRecentTransactionDate: mostRecent,
  };
}

module.exports = { availableMinor, getBalance, getSummary };
