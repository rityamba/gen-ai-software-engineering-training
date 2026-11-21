"use strict";

const {
  parseIsoDateTime,
  validateTimestamp,
  parseDateFilter,
} = require("../../src/utils/dates");

const NOW = new Date("2025-06-01T12:00:00.000Z");
const INVALID =
  "Timestamp must be a valid ISO 8601 date-time with a timezone, e.g. 2024-01-15T10:30:00Z";

describe("dates (AD-6)", () => {
  it.each([
    ["2024-01-15T10:30:00Z", "2024-01-15T10:30:00.000Z"],
    ["2024-01-15T10:30:00.5Z", "2024-01-15T10:30:00.500Z"],
    ["2024-01-15T10:30:00.123Z", "2024-01-15T10:30:00.123Z"],
    ["2024-01-15T10:30:00+02:00", "2024-01-15T08:30:00.000Z"],
    ["2024-01-15T10:30:00-05:30", "2024-01-15T16:00:00.000Z"],
    ["2024-02-29T00:00:00Z", "2024-02-29T00:00:00.000Z"],
    ["2000-02-29T23:59:59Z", "2000-02-29T23:59:59.000Z"],
    ["0050-06-01T00:00:00Z", "0050-06-01T00:00:00.000Z"],
  ])("D1 parses %s as %s", (input, iso) => {
    expect(parseIsoDateTime(input).toISOString()).toBe(iso);
  });

  it.each([
    ["no timezone", "2024-01-15T10:30:00"],
    ["date only", "2024-01-15"],
    ["no seconds", "2024-01-15T10:30Z"],
    ["space separator", "2024-01-15 10:30:00Z"],
    ["lower-case z", "2024-01-15T10:30:00z"],
    ["4 fraction digits", "2024-01-15T10:30:00.1234Z"],
    ["impossible day", "2024-02-30T10:30:00Z"],
    ["29 Feb in a non-leap year", "2023-02-29T10:30:00Z"],
    ["29 Feb 1900", "1900-02-29T10:30:00Z"],
    ["day 31 in April", "2024-04-31T10:30:00Z"],
    ["month 13", "2024-13-01T10:30:00Z"],
    ["month 00", "2024-00-01T10:30:00Z"],
    ["day 00", "2024-01-00T10:30:00Z"],
    ["hour 24", "2024-01-15T24:00:00Z"],
    ["minute 60", "2024-01-15T10:60:00Z"],
    ["second 60", "2024-01-15T10:30:60Z"],
    ["offset hour 24", "2024-01-15T10:30:00+24:00"],
    ["offset minute 60", "2024-01-15T10:30:00+02:60"],
    ["offset without colon", "2024-01-15T10:30:00+0200"],
    ["free text", "January 15, 2024"],
    ["empty string", ""],
  ])("D1 rejects %s (%s)", (_label, input) => {
    expect(parseIsoDateTime(input)).toBeNull();
  });

  it.each([null, 1705314600000, {}, undefined])(
    "D1 rejects non-string %p",
    (input) => {
      expect(parseIsoDateTime(input)).toBeNull();
    },
  );

  it("FR-4.5 accepts a past timestamp and exactly now", () => {
    expect(validateTimestamp("2024-01-15T10:30:00Z", NOW)).toBeNull();
    expect(validateTimestamp("2025-06-01T12:00:00.000Z", NOW)).toBeNull();
  });

  it("FR-4.5 rejects a timestamp 1 ms in the future (zero tolerance)", () => {
    expect(validateTimestamp("2025-06-01T12:00:00.001Z", NOW)).toBe(
      "Timestamp must not be in the future",
    );
  });

  it("FR-4.5 compares instants, not wall-clock text, across offsets", () => {
    // 13:30+02:00 is 11:30Z, before NOW; 11:30-02:00 is 13:30Z, after NOW.
    expect(validateTimestamp("2025-06-01T13:30:00+02:00", NOW)).toBeNull();
    expect(validateTimestamp("2025-06-01T11:30:00-02:00", NOW)).toBe(
      "Timestamp must not be in the future",
    );
  });

  it("FR-4.5 rejects a malformed timestamp with a format hint", () => {
    expect(validateTimestamp("yesterday", NOW)).toBe(INVALID);
  });

  it("BR-004 rejects a year-0000 timestamp whose offset resolves before year 0", () => {
    expect(parseIsoDateTime("0000-01-01T00:00:00+01:00")).toBeNull();
    expect(validateTimestamp("0000-01-01T00:00:00+01:00", NOW)).toBe(INVALID);
  });

  it("BR-004 still accepts the start of year 0000 in UTC", () => {
    const date = parseIsoDateTime("0000-01-01T00:00:00Z");

    expect(date).toBeInstanceOf(Date);
    expect(date.toISOString()).toMatch(/^0000-/);
  });

  it("FR-4.5 uses the real clock by default", () => {
    expect(validateTimestamp("2999-01-01T00:00:00Z")).toBe(
      "Timestamp must not be in the future",
    );
  });
});

describe("parseDateFilter (FR-5.3, D21)", () => {
  it.each([
    ["2024-01-31", "start", "2024-01-31T00:00:00.000Z"],
    ["2024-01-31", "end", "2024-01-31T23:59:59.999Z"],
    ["2024-02-29", "end", "2024-02-29T23:59:59.999Z"],
    ["0050-06-01", "start", "0050-06-01T00:00:00.000Z"],
    ["2024-01-15T10:30:00+02:00", "start", "2024-01-15T08:30:00.000Z"],
    ["2024-01-15T10:30:00Z", "end", "2024-01-15T10:30:00.000Z"],
    ["2099-01-01T00:00:00Z", "end", "2099-01-01T00:00:00.000Z"],
  ])("D21 parses %s (%s) as %s", (input, boundary, iso) => {
    expect(parseDateFilter(input, boundary).toISOString()).toBe(iso);
  });

  it.each([
    ["impossible day", "2023-02-29"],
    ["month 13", "2024-13-01"],
    ["day 0", "2024-01-00"],
    ["date-time without timezone", "2024-01-15T10:30:00"],
    ["single-digit month", "2024-1-15"],
    ["not a date", "yesterday"],
  ])("D21 rejects %s", (_label, input) => {
    expect(parseDateFilter(input, "start")).toBeNull();
  });

  it("D21 rejects a non-string value", () => {
    expect(parseDateFilter(["2024-01-01"], "start")).toBeNull();
  });
});
