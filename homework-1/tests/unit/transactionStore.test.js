"use strict";

const store = require("../../src/store/transactionStore");

describe("transactionStore (AD-3)", () => {
  beforeEach(() => store.reset());

  it("AD-8 assigns increasing seq and keeps insertion order", () => {
    const a = store.add({ id: "a" });
    const b = store.add({ id: "b" });
    expect([a.seq, b.seq]).toEqual([1, 2]);
    expect(store.getAll().map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("D22 stored records are immutable", () => {
    const a = store.add({ id: "a", status: "completed" });
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(store.getById("a"))).toBe(true);
  });

  it("AD-3 getAll returns a copy, so callers cannot change the store", () => {
    store.add({ id: "a" });
    store.getAll().pop();
    expect(store.getAll()).toHaveLength(1);
  });

  it("AD-3 reset clears records and restarts seq", () => {
    store.add({ id: "a" });
    store.reset();
    expect(store.getAll()).toEqual([]);
    expect(store.getById("a")).toBeUndefined();
    expect(store.add({ id: "b" }).seq).toBe(1);
  });
});
