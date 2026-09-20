import { describe, it, expect } from "vitest";
import { validateSummary, validateDescription } from "../../src/lib/validators.js";

// UNIT-02: BR-07 / BR-08
describe("validateSummary", () => {
  it("rejects strings shorter than 5 characters", () => {
    expect(validateSummary("Hi")).toBeTruthy();
  });
  it("rejects strings longer than 120 characters", () => {
    expect(validateSummary("x".repeat(121))).toBeTruthy();
  });
  it("accepts a valid trimmed summary", () => {
    expect(validateSummary("  Laptop battery drains quickly  ")).toBeNull();
  });
});

describe("validateDescription", () => {
  it("rejects strings shorter than 10 characters", () => {
    expect(validateDescription("short")).toBeTruthy();
  });
  it("accepts a valid description", () => {
    expect(validateDescription("The battery drains fast even when idle.")).toBeNull();
  });
});
