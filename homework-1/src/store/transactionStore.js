"use strict";

/**
 * In-memory transaction repository (AD-3): an array in insertion order plus a Map by id.
 * There is no update or delete; transactions are immutable (D22).
 */
let records = [];
let byId = new Map();
let nextSeq = 1;

/**
 * Stores a record and assigns its internal creation-order `seq` (AD-8).
 * @param {object} record
 * @returns {object} the stored, frozen record
 */
function add(record) {
  const stored = Object.freeze({ ...record, seq: nextSeq++ });
  records.push(stored);
  byId.set(stored.id, stored);
  return stored;
}

/** @returns {object[]} all records in insertion order (a copy of the list). */
function getAll() {
  return records.slice();
}

/** @returns {object|undefined} */
function getById(id) {
  return byId.get(id);
}

/** Clears all data. For tests only; not reachable over HTTP. */
function reset() {
  records = [];
  byId = new Map();
  nextSeq = 1;
}

module.exports = { add, getAll, getById, reset };
