"use strict";

const express = require("express");
const { validateAccountId } = require("../validators/accountIdValidator");
const accountService = require("../services/accountService");
const ValidationError = require("../errors/ValidationError");
const { unknownQueryParamMessage } = require("../utils/constants");

const router = express.Router();

/** GET /accounts/:accountId/balance — FR-3, FR-4.2, D4, D16, D22 */
router.get("/accounts/:accountId/balance", (req, res) => {
  // The endpoint takes no query parameters; any one is rejected so that, e.g.,
  // ?currency=USD can't silently return every currency (D16).
  const details = [
    ...validateAccountId(req.params.accountId),
    ...Object.keys(req.query).map((param) => ({
      field: param,
      message: unknownQueryParamMessage(param),
    })),
  ];
  if (details.length > 0) throw new ValidationError(details);

  res.status(200).json(accountService.getBalance(req.params.accountId));
});

module.exports = router;
