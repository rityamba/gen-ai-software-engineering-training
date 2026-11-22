"use strict";

const express = require("express");

const router = express.Router();

/** GET /health — FR-8.1, D8 */
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

module.exports = router;
