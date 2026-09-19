import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, validatePasswordPolicy } from "../../src/lib/auth.js";

// UNIT-01 (tests.md): password hashing (BR-07) and password policy (BR-08).
// Pure functions — no database, no server — so this runs without .env.test.

describe("hashPassword / verifyPassword (BR-07)", () => {
  it("never stores or returns the plaintext password", async () => {
    const hash = await hashPassword("CorrectHorse1!");
    expect(hash).not.toBe("CorrectHorse1!");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("produces a bcrypt hash tagged with a cost factor of at least 12", async () => {
    const hash = await hashPassword("CorrectHorse1!");
    // bcrypt hashes look like $2a$12$... / $2b$12$... — the second field is the cost.
    const match = hash.match(/^\$2[aby]\$(\d+)\$/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(12);
  });

  it("verifies the correct password against its own hash", async () => {
    const hash = await hashPassword("CorrectHorse1!");
    await expect(verifyPassword("CorrectHorse1!", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password against a real hash", async () => {
    const hash = await hashPassword("CorrectHorse1!");
    await expect(verifyPassword("WrongPassword1!", hash)).resolves.toBe(false);
  });

  it("produces a different hash for the same password each time (salted)", async () => {
    const a = await hashPassword("CorrectHorse1!");
    const b = await hashPassword("CorrectHorse1!");
    expect(a).not.toBe(b);
  });

  it("fails safe (returns false, never throws) against a malformed/sentinel hash", async () => {
    // Simulates the Lab 2 -> Lab 3 migration placeholder hash mentioned in
    // auth.ts's comment: not a real bcrypt hash at all.
    await expect(verifyPassword("anything", "not-a-real-hash")).resolves.toBe(false);
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
  });
});

describe("validatePasswordPolicy (BR-08)", () => {
  it("accepts a password meeting all four rules", () => {
    expect(validatePasswordPolicy("Abcdef1!")).toBeNull();
  });

  it("rejects a non-string input", () => {
    expect(validatePasswordPolicy(undefined)).toBe("Password is required");
    expect(validatePasswordPolicy(12345678)).toBe("Password is required");
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(validatePasswordPolicy("Ab1!xyz")).toBe("Password must be at least 8 characters");
  });

  it("rejects a password with no lowercase letter", () => {
    expect(validatePasswordPolicy("ABCDEF1!")).toBe("Password must include a lowercase letter");
  });

  it("rejects a password with no uppercase letter", () => {
    expect(validatePasswordPolicy("abcdef1!")).toBe("Password must include an uppercase letter");
  });

  it("rejects a password with no digit", () => {
    expect(validatePasswordPolicy("Abcdefg!")).toBe("Password must include a number");
  });

  it("rejects a password with no special character", () => {
    expect(validatePasswordPolicy("Abcdefg1")).toBe("Password must include a special character");
  });
});
