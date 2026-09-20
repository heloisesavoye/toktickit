import { describe, it, expect, vi } from "vitest";
import { generateTicketNumber } from "../../src/lib/ticketNumber.js";

// UNIT-01: format + sequential uniqueness (AC-01)
describe("generateTicketNumber", () => {
  it("returns TKT-YYYY-NNNNNN format", async () => {
    const fakePrisma: any = {
      ticketSequence: {
        upsert: vi.fn().mockResolvedValue({ year: 2026, value: 1 }),
      },
    };
    const result = await generateTicketNumber(fakePrisma, new Date("2026-08-24"));
    expect(result).toMatch(/^TKT-2026-\d{6}$/);
  });

  it("produces sequential, unique numbers across repeated calls", async () => {
    let counter = 0;
    const fakePrisma: any = {
      ticketSequence: {
        upsert: vi.fn().mockImplementation(async () => {
          counter += 1;
          return { year: 2026, value: counter };
        }),
      },
    };
    const numbers = new Set<string>();
    for (let i = 0; i < 100; i++) {
      numbers.add(await generateTicketNumber(fakePrisma, new Date("2026-08-24")));
    }
    expect(numbers.size).toBe(100);
  });
});
