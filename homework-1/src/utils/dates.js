"use strict";

/**
 * Strict ISO 8601 date-time handling (AD-6). Date.parse is too lenient: it accepts
 * non-ISO text and silently rolls impossible dates forward, so it is not used for checks.
 */

/** YYYY-MM-DDTHH:mm:ss[.s{1,3}](Z|±hh:mm) — seconds and an offset are required. */
const DATE_TIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|([+-])(\d{2}):(\d{2}))$/;

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year, month) {
  const days = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return days[month - 1];
}

/**
 * Parses a strict ISO 8601 date-time with an offset.
 * @param {unknown} value
 * @returns {Date|null} the instant, or null when the value is not a real, well-formed date-time
 */
function parseIsoDateTime(value) {
  if (typeof value !== "string") return null;
  const match = DATE_TIME_REGEX.exec(value);
  if (!match) return null;

  const [, y, mo, d, h, mi, s, frac, sign, oh, om] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;

  let offsetMinutes = 0;
  if (sign) {
    const offsetHours = Number(oh);
    const offsetMins = Number(om);
    if (offsetHours > 23 || offsetMins > 59) return null;
    offsetMinutes = (sign === "+" ? 1 : -1) * (offsetHours * 60 + offsetMins);
  }

  const millis = frac ? Number(frac.padEnd(3, "0")) : 0;
  // setUTCFullYear avoids Date.UTC mapping years 0–99 to 1900–1999.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millis);
  return new Date(date.getTime() - offsetMinutes * 60_000);
}

/**
 * Checks a client-supplied transaction timestamp (FR-1.3, FR-4.5, D1).
 * @param {unknown} value
 * @param {Date} [now] the current time; injectable for tests
 * @returns {string|null} an error message, or null when valid
 */
function validateTimestamp(value, now = new Date()) {
  const date = parseIsoDateTime(value);
  if (!date) {
    return "Timestamp must be a valid ISO 8601 date-time with a timezone, e.g. 2024-01-15T10:30:00Z";
  }
  if (date.getTime() > now.getTime()) {
    return "Timestamp must not be in the future";
  }
  return null;
}

module.exports = { parseIsoDateTime, validateTimestamp };
