"use strict";

const errorHandler = require("../../src/middleware/errorHandler");
const ValidationError = require("../../src/errors/ValidationError");
const NotFoundError = require("../../src/errors/NotFoundError");

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

const req = { method: "POST", originalUrl: "/transactions" };

describe("errorHandler (§10.1)", () => {
  afterEach(() => jest.restoreAllMocks());

  it("FR-4.6 ValidationError gives 400 with every detail", () => {
    const res = mockRes();
    const details = [
      { field: "amount", message: "Amount must be a positive number" },
      { field: "currency", message: "Unsupported currency code" },
    ];

    errorHandler(new ValidationError(details), req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Validation failed",
      details,
    });
  });

  it('FR-7.2 JSON parse error gives 400 "Malformed JSON" on field body', () => {
    const res = mockRes();
    const err = Object.assign(new SyntaxError("Unexpected end"), {
      type: "entity.parse.failed",
    });

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Validation failed",
      details: [{ field: "body", message: "Malformed JSON" }],
    });
  });

  it("§9 body-too-large error gives 413 on field body", () => {
    const res = mockRes();
    const err = Object.assign(new Error("request entity too large"), {
      type: "entity.too.large",
    });

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      error: "Validation failed",
      details: [
        { field: "body", message: "Request body must not exceed 100kb" },
      ],
    });
  });

  it("FR-7.2 NotFoundError gives 404 with its message", () => {
    const res = mockRes();

    errorHandler(
      new NotFoundError("Transaction not found"),
      req,
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Transaction not found" });
  });

  it('FR-7.2 NotFoundError defaults to "Not found"', () => {
    const res = mockRes();

    errorHandler(new NotFoundError(), req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ error: "Not found" });
  });

  it("§10.2 unexpected error gives a generic 500 and logs the stack to stderr", () => {
    const res = mockRes();
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("secret internal detail");

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("secret");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain("POST /transactions 500");
    expect(spy.mock.calls[0][0]).toContain(err.stack);
  });

  it("§10.2 a non-Error value thrown still gives a generic 500", () => {
    const res = mockRes();
    jest.spyOn(console, "error").mockImplementation(() => {});

    errorHandler("boom", req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});
