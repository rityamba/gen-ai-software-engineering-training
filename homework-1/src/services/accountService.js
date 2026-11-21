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

/**
 * Funds available for a withdrawal or transfer (FR-1.7). Other currencies never count.
 * @param {string} accountId
 * @param {string} currency
 * @returns {number} hundredths
 */
function availableMinor(accountId, currency) {
  return balanceMinorByCurrency(accountId).get(currency) ?? 0;
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

module.exports = { availableMinor, getBalance };
