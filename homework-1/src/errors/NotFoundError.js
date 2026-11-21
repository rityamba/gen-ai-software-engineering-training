"use strict";

/**
 * Maps to 404 with the given message as `error` (§6.7, §10.1).
 */
class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

module.exports = NotFoundError;
