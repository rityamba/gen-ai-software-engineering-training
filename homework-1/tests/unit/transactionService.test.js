"use strict";

const service = require("../../src/services/transactionService");
const store = require("../../src/store/transactionStore");
const { validBody } = require("../helpers/transactions");

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("transactionService", () => {
  beforeEach(() => store.reset());

  describe("create", () => {
    it("FR-1.2 generates a UUID v4 id and FR-1.4 sets status completed", () => {
      const t = service.create(validBody.deposit());
      expect(t.id).toMatch(UUID_V4);
      expect(t.status).toBe("completed");
      expect(t).not.toHaveProperty("failureReason");
    });

    it("FR-1.2 ids are unique", () => {
      const a = service.create(validBody.deposit());
      const b = service.create(validBody.deposit());
      expect(a.id).not.toBe(b.id);
    });

    it("D1 uses the current time when no timestamp is supplied", () => {
      const now = new Date("2025-06-01T12:00:00.000Z");
      expect(service.create(validBody.deposit(), { now }).timestamp).toBe(
        "2025-06-01T12:00:00.000Z",
      );
    });

    it("D1 keeps a supplied timestamp, normalised to UTC with milliseconds", () => {
      const t = service.create(
        validBody.deposit({ timestamp: "2024-01-15T10:30:00+02:00" }),
      );
      expect(t.timestamp).toBe("2024-01-15T08:30:00.000Z");
    });

    it("R1 returns both account fields, null where not applicable", () => {
      expect(service.create(validBody.deposit()).fromAccount).toBeNull();
      expect(service.create(validBody.withdrawal()).toAccount).toBeNull();
      expect(
        service.create(validBody.deposit({ fromAccount: null })).fromAccount,
      ).toBeNull();
    });

    it("§5.2 hides internal fields and returns amount in major units", () => {
      service.create(validBody.deposit()); // funds ACC-12345 so the transfer completes
      const t = service.create(validBody.transfer({ amount: 1.15 }));
      expect(Object.keys(t)).toEqual([
        "id",
        "fromAccount",
        "toAccount",
        "amount",
        "currency",
        "type",
        "timestamp",
        "status",
      ]);
      expect(t.amount).toBe(1.15);
      expect(store.getById(t.id).amountMinor).toBe(115);
    });
  });

  describe("create — funds rule (FR-1.7, D2)", () => {
    it("FR-1.7 an unfunded withdrawal is stored as failed with a failureReason", () => {
      const t = service.create(validBody.withdrawal());

      expect(t.status).toBe("failed");
      expect(t.failureReason).toBe("INSUFFICIENT_FUNDS");
      expect(store.getById(t.id).status).toBe("failed");
    });

    it("FR-1.7 an unfunded transfer is failed, a funded one completed", () => {
      expect(service.create(validBody.transfer()).status).toBe("failed");

      service.create(validBody.deposit({ amount: 100.5 }));
      expect(service.create(validBody.transfer()).status).toBe("completed");
    });

    it("FR-1.7 a later transfer cannot spend what an earlier one already used", () => {
      service.create(validBody.deposit({ amount: 150 }));

      expect(service.create(validBody.transfer({ amount: 100 })).status).toBe(
        "completed",
      );
      expect(service.create(validBody.transfer({ amount: 100 })).status).toBe(
        "failed",
      );
    });
  });

  describe("list", () => {
    it("FR-2.1 returns an empty array when there are no transactions", () => {
      expect(service.list()).toEqual([]);
    });

    it("FR-5.1 the account filter matches the source or the destination", () => {
      const deposit = service.create(validBody.deposit());
      const transfer = service.create(validBody.transfer());
      service.create(validBody.deposit({ toAccount: "ACC-OTHER" }));

      expect(service.list({ accountId: "ACC-67890" }).map((t) => t.id)).toEqual(
        [transfer.id],
      );
      expect(
        service
          .list({ accountId: "ACC-12345" })
          .map((t) => t.id)
          .sort(),
      ).toEqual([deposit.id, transfer.id].sort());
    });

    it("FR-5.3 date bounds are inclusive at both ends", () => {
      service.create(validBody.deposit({ timestamp: "2024-01-01T00:00:00Z" }));
      service.create(
        validBody.deposit({ timestamp: "2024-01-31T23:59:59.999Z" }),
      );
      service.create(validBody.deposit({ timestamp: "2024-02-01T00:00:00Z" }));

      const result = service.list({
        from: new Date("2024-01-01T00:00:00.000Z"),
        to: new Date("2024-01-31T23:59:59.999Z"),
      });
      expect(result.map((t) => t.timestamp)).toEqual([
        "2024-01-31T23:59:59.999Z",
        "2024-01-01T00:00:00.000Z",
      ]);
    });

    it("FR-5.4 combines filters with AND", () => {
      service.create(validBody.deposit({ amount: 500 }));
      const transfer = service.create(validBody.transfer());
      service.create(validBody.withdrawal({ amount: 9999 })); // failed

      expect(
        service.list({
          accountId: "ACC-12345",
          type: "transfer",
          status: "completed",
        }),
      ).toEqual([transfer]);
      expect(service.list({ type: "withdrawal", status: "completed" })).toEqual(
        [],
      );
    });

    it("FR-2.3 sorts newest first by timestamp", () => {
      service.create(validBody.deposit({ timestamp: "2024-01-10T00:00:00Z" }));
      service.create(validBody.deposit({ timestamp: "2024-03-01T00:00:00Z" }));
      service.create(validBody.deposit({ timestamp: "2024-02-01T00:00:00Z" }));
      expect(service.list().map((t) => t.timestamp)).toEqual([
        "2024-03-01T00:00:00.000Z",
        "2024-02-01T00:00:00.000Z",
        "2024-01-10T00:00:00.000Z",
      ]);
    });

    it("AD-8 breaks timestamp ties by creation order, later first", () => {
      const ts = "2024-01-15T10:30:00Z";
      const first = service.create(validBody.deposit({ timestamp: ts }));
      const second = service.create(validBody.deposit({ timestamp: ts }));
      expect(service.list().map((t) => t.id)).toEqual([second.id, first.id]);
    });

    it("AD-8 compares instants, so offsets do not break ordering", () => {
      // 10:00+02:00 = 08:00Z, earlier than 09:00Z
      service.create(
        validBody.deposit({ timestamp: "2024-01-15T10:00:00+02:00" }),
      );
      service.create(validBody.deposit({ timestamp: "2024-01-15T09:00:00Z" }));
      expect(service.list().map((t) => t.timestamp)).toEqual([
        "2024-01-15T09:00:00.000Z",
        "2024-01-15T08:00:00.000Z",
      ]);
    });
  });

  describe("getById", () => {
    it("FR-2.2 returns the transaction or null", () => {
      const t = service.create(validBody.deposit());
      expect(service.getById(t.id)).toEqual(t);
      expect(
        service.getById("00000000-0000-4000-8000-000000000000"),
      ).toBeNull();
      expect(service.getById("__proto__")).toBeNull();
    });
  });
});
