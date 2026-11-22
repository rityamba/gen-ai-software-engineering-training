"use strict";

const request = require("supertest");
const store = require("../../src/store/transactionStore");
const { app, validBody, postTransaction } = require("../helpers/transactions");

const A = "ACC-12345";
const B = "ACC-67890";
const C = "ACC-C0000";

function list(query) {
  return request(app).get(`/transactions${query}`);
}

/**
 * A small history: A is funded, sends one transfer to B, and one withdrawal fails.
 * Timestamps cover the January 2024 edges and a transaction outside the month.
 */
async function seed() {
  const ids = {};
  const post = async (name, body) => {
    const res = await postTransaction(body);
    ids[name] = res.body.id;
    return res.body;
  };
  await post(
    "depositA",
    validBody.deposit({ amount: 1000, timestamp: "2024-01-01T00:00:00Z" }),
  );
  await post(
    "transferAB",
    validBody.transfer({ amount: 100.5, timestamp: "2024-01-15T10:30:00Z" }),
  );
  await post(
    "failedWithdrawal",
    validBody.withdrawal({ amount: 5000, timestamp: "2024-01-31T23:59:59Z" }),
  );
  await post(
    "depositC",
    validBody.deposit({
      toAccount: C,
      amount: 10,
      currency: "EUR",
      timestamp: "2024-02-01T00:00:00Z",
    }),
  );
  await post(
    "lateDecember",
    validBody.deposit({ amount: 1, timestamp: "2023-12-31T23:59:59Z" }),
  );
  return ids;
}

const idsOf = (res) => res.body.map((t) => t.id);

describe("GET /transactions filters (FR-5)", () => {
  let ids;

  beforeEach(async () => {
    store.reset();
    ids = await seed();
  });

  describe("each filter alone", () => {
    it("FR-5.1 accountId matches the source or the destination", async () => {
      const res = await list(`?accountId=${B}`);

      expect(res.status).toBe(200);
      expect(idsOf(res)).toEqual([ids.transferAB]);
      expect(idsOf(await list(`?accountId=${A}`))).toEqual([
        ids.failedWithdrawal,
        ids.transferAB,
        ids.depositA,
        ids.lateDecember,
      ]);
    });

    it("D14 accountId matches in any case", async () => {
      expect(idsOf(await list("?accountId=acc-67890"))).toEqual([
        ids.transferAB,
      ]);
    });

    it("FR-5.2 type returns only that type", async () => {
      const res = await list("?type=deposit");

      expect(res.body.every((t) => t.type === "deposit")).toBe(true);
      expect(idsOf(res)).toEqual([
        ids.depositC,
        ids.depositA,
        ids.lateDecember,
      ]);
    });

    it("FR-5.7/D15 status returns only that status", async () => {
      expect(idsOf(await list("?status=failed"))).toEqual([
        ids.failedWithdrawal,
      ]);
      expect((await list("?status=pending")).body).toEqual([]);
    });

    it("FR-5.3 from alone is inclusive", async () => {
      expect(idsOf(await list("?from=2024-01-31T23:59:59Z"))).toEqual([
        ids.depositC,
        ids.failedWithdrawal,
      ]);
    });

    it("FR-5.3 to alone is inclusive", async () => {
      expect(idsOf(await list("?to=2024-01-01T00:00:00Z"))).toEqual([
        ids.depositA,
        ids.lateDecember,
      ]);
    });
  });

  describe("date range (D21)", () => {
    it("UF-2 the specification example returns January 2024, including the 31st", async () => {
      const res = await list("?from=2024-01-01&to=2024-01-31");

      expect(res.status).toBe(200);
      expect(idsOf(res)).toEqual([
        ids.failedWithdrawal,
        ids.transferAB,
        ids.depositA,
      ]);
    });

    it("D21 a date-only to includes the last millisecond of that day", async () => {
      await postTransaction(
        validBody.deposit({ timestamp: "2024-01-31T23:59:59.999Z" }),
      );

      const res = await list("?to=2024-01-31&from=2024-01-31");
      expect(res.body.map((t) => t.timestamp)).toEqual([
        "2024-01-31T23:59:59.999Z",
        "2024-01-31T23:59:59.000Z",
      ]);
    });

    it("D21 a date-only from starts at 00:00 UTC", async () => {
      expect(idsOf(await list("?from=2024-02-01"))).toEqual([ids.depositC]);
    });

    it("AD-6 an offset encoded as %2B is accepted and compared as an instant", async () => {
      // 12:30+02:00 = 10:30Z, exactly the transfer's timestamp
      const res = await list(
        "?from=2024-01-15T12:30:00%2B02:00&to=2024-01-15T12:30:00%2B02:00",
      );

      expect(res.status).toBe(200);
      expect(idsOf(res)).toEqual([ids.transferAB]);
    });

    it("AD-6 a negative offset is compared as an instant, not as text", async () => {
      // 05:30-05:00 = 10:30Z, exactly the transfer's timestamp
      const res = await list(
        "?from=2024-01-15T05:30:00-05:00&to=2024-01-15T05:30:00-05:00",
      );

      expect(res.status).toBe(200);
      expect(idsOf(res)).toEqual([ids.transferAB]);
    });

    it("D21 a future to is allowed", async () => {
      const res = await list("?from=2024-02-01&to=2099-12-31");

      expect(res.status).toBe(200);
      expect(idsOf(res)).toEqual([ids.depositC]);
    });
  });

  describe("combined filters (FR-5.4)", () => {
    it("FR-5.4 all filters must match", async () => {
      const res = await list(
        `?accountId=${A}&type=transfer&status=completed&from=2024-01-01&to=2024-01-31`,
      );

      expect(idsOf(res)).toEqual([ids.transferAB]);
    });

    it("FR-5.4 a combination with no match returns an empty array", async () => {
      const res = await list(`?accountId=${B}&type=deposit`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("FR-2.3 filtered results stay newest first", async () => {
      const res = await list(`?accountId=${A}&from=2024-01-01`);
      const stamps = res.body.map((t) => t.timestamp);

      expect(stamps).toEqual([...stamps].sort().reverse());
      expect(stamps).toHaveLength(3);
    });

    it("FR-2.1 an unfiltered list still returns everything", async () => {
      expect((await list("")).body).toHaveLength(5);
    });
  });

  describe("invalid filters (FR-5.5, D16)", () => {
    const expect400 = async (query, details) => {
      const res = await list(query);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Validation failed", details });
    };

    it("FR-5.5 unknown type", () =>
      expect400("?type=refund", [
        {
          field: "type",
          message: "Type must be one of: deposit, withdrawal, transfer",
        },
      ]));

    it("FR-5.5 unknown status", () =>
      expect400("?status=done", [
        {
          field: "status",
          message: "Status must be one of: pending, completed, failed",
        },
      ]));

    it("FR-5.6/D12 malformed account", () =>
      expect400("?accountId=acc-1234", [
        {
          field: "accountId",
          message:
            "Account must match the format ACC-XXXXX, where X is a letter or digit",
        },
      ]));

    it("FR-5.5 malformed date", () =>
      expect400("?from=2024-02-30", [
        {
          field: "from",
          message:
            "Invalid date. Use YYYY-MM-DD or an ISO 8601 date-time with a timezone, e.g. 2024-01-15T10:30:00Z",
        },
      ]));

    it('AD-6 an unencoded "+" offset gets a hint to use %2B', () =>
      expect400("?from=2024-01-15T10:30:00+02:00", [
        {
          field: "from",
          message: 'Invalid date. Encode "+" in an offset as %2B, or use Z',
        },
      ]));

    it('FR-5.5 "from" later than "to"', () =>
      expect400("?from=2024-02-01&to=2024-01-31", [
        { field: "from", message: '"from" must not be later than "to"' },
      ]));

    it("D16 repeated parameter", () =>
      expect400("?type=deposit&type=transfer", [
        {
          field: "type",
          message: 'Query parameter "type" must appear at most once',
        },
      ]));

    it("D16 unknown parameter", () =>
      expect400("?tpye=transfer", [
        { field: "tpye", message: 'Unknown query parameter "tpye"' },
      ]));

    it("D16 empty value", () =>
      expect400("?status=", [
        {
          field: "status",
          message: 'Query parameter "status" must not be empty',
        },
      ]));

    it("D16/AD-2 bracket syntax is not parsed into objects, so it is unknown", () =>
      expect400("?type[eq]=deposit", [
        { field: "type[eq]", message: 'Unknown query parameter "type[eq]"' },
      ]));

    it.each(["__proto__", "constructor"])(
      "D16 a prototype key (%s) is just an unknown parameter",
      (key) =>
        expect400(`?${key}=x`, [
          { field: key, message: `Unknown query parameter "${key}"` },
        ]),
    );

    it("FR-4.6 every problem is reported at once", async () => {
      const res = await list("?type=refund&accountId=bad&foo=1");

      expect(res.status).toBe(400);
      expect(res.body.details.map((d) => d.field)).toEqual([
        "accountId",
        "type",
        "foo",
      ]);
    });
  });
});
