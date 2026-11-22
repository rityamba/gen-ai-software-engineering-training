"use strict";

/**
 * Phase 5 acceptance (D7, product plan §7, technical plan §11): every functional
 * requirement and every behavioural decision is covered by at least one test whose
 * name starts with its ID. A test may lead with several IDs joined by "/", for example
 * "FR-3.4/D4 ...". Only `it` / `test` titles count, not `describe` blocks.
 * Reads the plans and the test sources, so a new FR or decision without a test fails here.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** Decisions about process, tooling or audience: verified outside the test suite. */
const NOT_TESTABLE = {
  D5: "process: each phase ships with its own tests",
  D6: "process: phase order",
  D9: "product: target users",
  "AD-1": "tooling: JavaScript (CommonJS)",
  "AD-9": "tooling: Jest + supertest (the suite itself)",
  "AD-10":
    "tooling: ESLint + Prettier, enforced by npm run lint / format:check",
};

function requiredIds() {
  const product = read("docs/product-execution-plan.md");
  const technical = read("docs/technical-implementation-plan.md");
  const ids = new Set();
  for (const m of product.matchAll(/\*\*(FR-\d+\.\d+)\*\*/g)) ids.add(m[1]);
  for (const m of product.matchAll(/^\| \*\*(D\d+)\*\*/gm)) ids.add(m[1]);
  for (const m of technical.matchAll(/^### (AD-\d+)/gm)) ids.add(m[1]);
  return ids;
}

function testFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return testFiles(full);
    return entry.name.endsWith(".test.js") ? [full] : [];
  });
}

/** Every `it` / `test` title (including `.each` templates) in the suite. */
function testTitles() {
  const title =
    /\b(?:it|test)(?:\.each\([\s\S]*?\))?\(\s*(["'`])((?:(?!\1)[\s\S])*)\1/g;
  return testFiles(__dirname).flatMap((file) =>
    [...fs.readFileSync(file, "utf8").matchAll(title)].map((m) => m[2]),
  );
}

/** The IDs a title leads with: "FR-3.4/D4 empty balance" → ["FR-3.4", "D4"]. */
function leadingIds(title) {
  return title.trimStart().split(/\s/, 1)[0].split("/");
}

describe("traceability (Phase 5)", () => {
  const titles = testTitles();
  const ids = requiredIds();

  it("D7 finds the requirement IDs in the plans", () => {
    expect(
      [...ids].filter((id) => id.startsWith("FR-")).length,
    ).toBeGreaterThanOrEqual(38);
    expect(ids.has("D22")).toBe(true);
    expect(ids.has("AD-8")).toBe(true);
  });

  it.each([...ids].filter((id) => !(id in NOT_TESTABLE)))(
    "D7 at least one test name starts with %s",
    (id) => {
      expect(titles.some((t) => leadingIds(t).includes(id))).toBe(true);
    },
  );

  it("D7 a mid-title ID does not count, a leading /-joined one does", () => {
    expect(leadingIds("FR-2.3 lists newest first (D10)")).toEqual(["FR-2.3"]);
    expect(leadingIds("FR-3.4/D4 empty balance")).toEqual(["FR-3.4", "D4"]);
  });

  it("D7 describe titles are not collected, only it/test titles", () => {
    // This file's own describe and it titles serve as the fixture.
    expect(titles).not.toContain("traceability (Phase 5)");
    expect(titles).toContain(
      "D7 describe titles are not collected, only it/test titles",
    );
  });

  it("D7 every excluded ID still exists in the plans", () => {
    for (const id of Object.keys(NOT_TESTABLE)) expect(ids.has(id)).toBe(true);
  });

  it("D7 the coverage gate is at least 80% of lines and branches", () => {
    const { coverageThreshold } = require("../jest.config");
    expect(coverageThreshold.global.lines).toBeGreaterThanOrEqual(80);
    expect(coverageThreshold.global.branches).toBeGreaterThanOrEqual(80);
  });
});
