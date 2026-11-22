"use strict";

const express = require("express");
const {
  validateAccountId,
  normalizeAccountId,
} = require("../validators/accountIdValidator");
const accountService = require("../services/accountService");
const ValidationError = require("../errors/ValidationError");
const { unknownQueryParamMessage } = require("../utils/constants");

const router = express.Router();

/**
 * Shared by the account endpoints: checks the path id and rejects every query
 * parameter, so that, e.g., ?currency=USD can't silently return every currency (D16, D22).
 * Throws ValidationError with all problems at once.
 * @returns {string} the account id in its stored, upper-case form (D14)
 */
function accountIdFrom(req) {
  const details = [
    ...validateAccountId(req.params.accountId),
    ...Object.keys(req.query).map((param) => ({
      field: param,
      message: unknownQueryParamMessage(param),
    })),
  ];
  if (details.length > 0) throw new ValidationError(details);
  return normalizeAccountId(req.params.accountId);
}

/** GET /accounts/:accountId/balance — FR-3, FR-4.2, D4, D14, D16, D22 */
router.get("/accounts/:accountId/balance", (req, res) => {
  res.status(200).json(accountService.getBalance(accountIdFrom(req)));
});

/** GET /accounts/:accountId/summary — FR-6, D4, D14, D16, D19, D20, D22 */
router.get("/accounts/:accountId/summary", (req, res) => {
  res.status(200).json(accountService.getSummary(accountIdFrom(req)));
});

module.exports = router;
