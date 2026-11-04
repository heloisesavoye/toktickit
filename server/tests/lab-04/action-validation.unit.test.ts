import { describe, it, expect } from "vitest";
import {
  ACTIVE_STATUSES,
  evaluateResolutionGate,
  isValidActionTransition,
  validateActionInput,
} from "../../src/lib/actions.js";
import { STATUS_TRANSITIONS } from "../../src/lib/validators.js";

const ticketCreatedAt = new Date("2026-11-01T00:00:00Z");
const now = new Date("2026-11-04T05:00:00Z");

// UNIT-01 — BR-05, BR-06, BR-07
describe("validateActionInput", () => {
  const base = { description: "Replaced the network cable", result: "Link is up" };

  it("accepts a valid action and defaults actionAt to now", () => {
    const { fields, clean } = validateActionInput(base, { partial: false, ticketCreatedAt, now });
    expect(fields).toEqual({});
    expect(clean.actionAt).toEqual(now);
    expect(clean.description).toBe("Replaced the network cable");
  });

  it("rejects short descriptions and empty results after trimming", () => {
    const { fields } = validateActionInput(
      { description: "  abc ", result: "   " },
      { partial: false, ticketCreatedAt, now }
    );
    expect(fields.description).toBeDefined();
    expect(fields.result).toBeDefined();
  });

  it("requires a follow-up note when follow-up is required", () => {
    const { fields } = validateActionInput(
      { ...base, followUpRequired: true, followUpNote: "  " },
      { partial: false, ticketCreatedAt, now }
    );
    expect(fields.followUpNote).toMatch(/required/i);
  });

  it("clears the follow-up note when follow-up is not required", () => {
    const { fields, clean } = validateActionInput(
      { ...base, followUpRequired: false, followUpNote: "leftover" },
      { partial: false, ticketCreatedAt, now }
    );
    expect(fields).toEqual({});
    expect(clean.followUpNote).toBeNull();
  });

  it("rejects dates in the future (beyond skew) and before ticket creation", () => {
    const future = validateActionInput(
      { ...base, actionAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString() },
      { partial: false, ticketCreatedAt, now }
    );
    expect(future.fields.actionAt).toMatch(/future/i);
    const past = validateActionInput(
      { ...base, actionAt: "2026-10-01T00:00:00Z" },
      { partial: false, ticketCreatedAt, now }
    );
    expect(past.fields.actionAt).toMatch(/before/i);
  });

  it("PATCH: turning follow-up on with no existing note is rejected", () => {
    const { fields } = validateActionInput(
      { followUpRequired: true },
      { partial: true, ticketCreatedAt, now, existing: { followUpRequired: false, followUpNote: null } }
    );
    expect(fields.followUpNote).toBeDefined();
  });

  it("PATCH: only supplied fields are validated", () => {
    const { fields, clean } = validateActionInput(
      { result: "Updated result" },
      { partial: true, ticketCreatedAt, now, existing: { followUpRequired: false, followUpNote: null } }
    );
    expect(fields).toEqual({});
    expect(clean).toEqual({ result: "Updated result" });
  });
});

// UNIT-02 — BR-08
describe("evaluateResolutionGate", () => {
  it("blocks with no actions", () => {
    expect(evaluateResolutionGate([]).allowed).toBe(false);
  });
  it("blocks with only open actions", () => {
    expect(evaluateResolutionGate([{ status: "OPEN" }]).allowed).toBe(false);
  });
  it("blocks when a completed action exists but another is still open", () => {
    const gate = evaluateResolutionGate([{ status: "COMPLETED" }, { status: "OPEN" }]);
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/1 open/);
  });
  it("allows when at least one completed and none open (cancelled ignored)", () => {
    const gate = evaluateResolutionGate([{ status: "COMPLETED" }, { status: "CANCELLED" }]);
    expect(gate).toEqual({ allowed: true, completedActions: 1, openActions: 0, reason: null });
  });
});

// UNIT-03 — BR-09
describe("isValidActionTransition", () => {
  it("only allows OPEN -> COMPLETED / CANCELLED", () => {
    expect(isValidActionTransition("OPEN", "COMPLETED")).toBe(true);
    expect(isValidActionTransition("OPEN", "CANCELLED")).toBe(true);
    expect(isValidActionTransition("COMPLETED", "OPEN")).toBe(false);
    expect(isValidActionTransition("CANCELLED", "COMPLETED")).toBe(false);
    expect(isValidActionTransition("COMPLETED", "CANCELLED")).toBe(false);
  });
});

// UNIT-04 — specification.md §9 and BR-15
describe("final Ticket transition matrix", () => {
  it("matches the Lab 4 matrix exactly", () => {
    expect(STATUS_TRANSITIONS).toEqual({
      NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
      OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
      IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
      WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
      RESOLVED: ["CLOSED", "REOPENED"],
      CLOSED: ["REOPENED"],
      REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
      CANCELLED: [],
    });
  });
  it("defines the active status set", () => {
    expect([...ACTIVE_STATUSES]).toEqual(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"]);
  });
});
