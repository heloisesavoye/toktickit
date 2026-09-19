import { describe, expect, it } from "vitest";
import { STATUSES, STATUS_TRANSITIONS, isValidTransition } from "../../src/lib/validators.js";

// UNIT-02 (tests.md): BR-16 status transition matrix (specification.md §9).
// This is the server-side source of truth; client/src/lib/statusTransitions.ts
// is only a UI-facing mirror of the same table.

describe("STATUS_TRANSITIONS (BR-16 / specification.md §9)", () => {
  it("defines an entry (possibly empty) for every known status", () => {
    for (const status of STATUSES) {
      expect(STATUS_TRANSITIONS).toHaveProperty(status);
      expect(Array.isArray(STATUS_TRANSITIONS[status])).toBe(true);
    }
  });

  it("only ever points at other known statuses (no typos in the table)", () => {
    for (const [from, targets] of Object.entries(STATUS_TRANSITIONS)) {
      for (const to of targets) {
        expect(STATUSES as readonly string[]).toContain(to);
      }
      expect(targets).not.toContain(from); // no status transitions to itself
    }
  });

  it("terminal statuses only re-open, and CANCELLED has no way out", () => {
    expect(STATUS_TRANSITIONS.CANCELLED).toEqual([]);
    expect(STATUS_TRANSITIONS.RESOLVED).toEqual(["CLOSED", "REOPENED"]);
    expect(STATUS_TRANSITIONS.CLOSED).toEqual(["REOPENED"]);
  });

  // Exhaustive matrix check: every (from, to) pair in the full status set,
  // matched against specification.md §9's documented table.
  const expected: Record<string, string[]> = {
    NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
    OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
    IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
    RESOLVED: ["CLOSED", "REOPENED"],
    CLOSED: ["REOPENED"],
    REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
    CANCELLED: [],
  };

  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const shouldBeValid = (expected[from] ?? []).includes(to);
      it(`${from} -> ${to} is ${shouldBeValid ? "allowed" : "rejected"}`, () => {
        expect(isValidTransition(from, to)).toBe(shouldBeValid);
      });
    }
  }

  it("rejects an unknown 'from' status", () => {
    expect(isValidTransition("NOT_A_STATUS", "OPEN")).toBe(false);
  });

  it("rejects an unknown 'to' status", () => {
    expect(isValidTransition("NEW", "NOT_A_STATUS")).toBe(false);
  });
});
