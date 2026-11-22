"use strict";

const express = require("express");
const { validateTransaction } = require("../validators/transactionValidator");
const { validateTransactionQuery } = require("../validators/queryValidator");
const transactionService = require("../services/transactionService");
const ValidationError = require("../errors/ValidationError");
const NotFoundError = require("../errors/NotFoundError");

const router = express.Router();

/** POST /transactions — FR-1, FR-4 */
router.post("/transactions", (req, res) => {
  const details = validateTransaction(req.body);
  if (details.length > 0) throw new ValidationError(details);

  const transaction = transactionService.create(req.body);
  res.status(201).location(`/transactions/${transaction.id}`).json(transaction);
});

/** GET /transactions — FR-2.1, FR-2.3, FR-5, D16 */
router.get("/transactions", (req, res) => {
  const { details, filters } = validateTransactionQuery(req.query);
  if (details.length > 0) throw new ValidationError(details);

  res.status(200).json(transactionService.list(filters));
});

/** GET /transactions/:id — FR-2.2, D13: any unknown or malformed id is a 404. */
router.get("/transactions/:id", (req, res) => {
  const transaction = transactionService.getById(req.params.id);
  if (!transaction) throw new NotFoundError("Transaction not found");
  res.status(200).json(transaction);
});

module.exports = router;
