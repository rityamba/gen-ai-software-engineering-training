"use strict";

/**
 * Thrown by routes when a validator returns problems. Maps to 400 (§6.7, §10.1).
 * @param {{field: string, message: string}[]} details
 */
class ValidationError extends Error {
  constructor(details) {
    super("Validation failed");
    this.name = "ValidationError";
    this.details = details;
  }
}

module.exports = ValidationError;
