"use strict";

/** Transaction types (FR-4.4). */
const TYPES = Object.freeze(["deposit", "withdrawal", "transfer"]);

/** Shared by the body and query validators, so both report the same text. */
const TYPE_MESSAGE = `Type must be one of: ${TYPES.join(", ")}`;

/** Transaction statuses (FR-1.4). `pending` exists in the model but is never assigned. */
const STATUSES = Object.freeze(["pending", "completed", "failed"]);

/** Machine-readable reasons for a `failed` transaction (FR-1.7, D2). */
const FAILURE_REASONS = Object.freeze({
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
});

/**
 * `ACC-` + 5 letters or digits, in any case (FR-4.2, D14). A matching id is stored and
 * compared in upper case: see normalizeAccountId.
 */
const ACCOUNT_REGEX = /^ACC-[A-Z0-9]{5}$/i;

/** Shared by the body validator and the path validator, so both report the same text. */
const ACCOUNT_FORMAT_MESSAGE =
  "Account must match the format ACC-XXXXX, where X is a letter or digit";

/** Shared by every endpoint that rejects unexpected query parameters (D16). */
const unknownQueryParamMessage = (name) => `Unknown query parameter "${name}"`;

/** The only filters GET /transactions accepts, in error-report order (FR-5, D16, §6.2). */
const TRANSACTION_QUERY_PARAMS = Object.freeze([
  "accountId",
  "type",
  "status",
  "from",
  "to",
]);

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
 * Valid ISO 4217 codes: every currency in active circulation in ISO 4217 List One
 * (D18, AD-7). Left out on purpose: withdrawn codes (e.g. HRK, ANG, BGN, ZWL), fund
 * and unit-of-account codes (e.g. BOV, CLF, USN), precious metals (XAU, XAG, XPD, XPT),
 * IMF and settlement units (XDR, XSU, XUA, XBA–XBD) and the testing/no-currency codes
 * XTS and XXX: none of them is money an account can hold.
 * Last reviewed: 2026-11-22.
 */
const CURRENCIES = new Set(
  `
    AED AFN ALL AMD AOA ARS AUD AWG AZN BAM BBD BDT BHD BIF BMD BND
    BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE
    CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD
    GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY
    KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD
    MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO
    NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF
    SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB
    TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VED VES VND
    VUV WST XAF XCD XCG XOF XPF YER ZAR ZMW ZWG
  `
    .trim()
    .split(/\s+/),
);

module.exports = {
  TYPES,
  TYPE_MESSAGE,
  STATUSES,
  FAILURE_REASONS,
  ACCOUNT_REGEX,
  ACCOUNT_FORMAT_MESSAGE,
  unknownQueryParamMessage,
  TRANSACTION_QUERY_PARAMS,
  ALLOWED_FIELDS,
  SERVER_FIELDS,
  CURRENCIES,
};
