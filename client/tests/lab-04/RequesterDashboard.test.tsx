import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequesterDashboard } from "../../src/components/dashboard/RequesterDashboard";
import { api } from "../../src/api/client";

vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, name: "Jennifer Anderson", role: "REQUESTER" } }),
}));
vi.mock("../../src/api/client", async () => {
  const actual = await vi.importActual<any>("../../src/api/client");
  return { ...actual, api: { getRequesterDashboard: vi.fn() } };
});

const ticket = (id: number, summary: string, currentStatus: string) => ({
  id, ticketNumber: `TKT-2026-00000${id}`, summary, currentStatus, updatedAt: new Date().toISOString(),
});

const data = {
  metrics: {
    openTickets: { count: 3, filter: { status: "ACTIVE" } },
    waitingForMe: { count: 1, filter: { status: "WAITING_FOR_REQUESTER" } },
    resolved: { count: 2, filter: { status: "RESOLVED" } },
    closed: { count: 5, filter: { status: "CLOSED" } },
  },
  needsAttention: [ticket(4, "Laptop fan very loud", "WAITING_FOR_REQUESTER")],
  recentlyUpdated: [ticket(2, "Cannot connect to VPN", "IN_PROGRESS")],
  recentlyResolved: [],
};

describe("RequesterDashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  // UI-04 — FR-15
  it("shows own metrics, attention list, and drills down", async () => {
    (api.getRequesterDashboard as any).mockResolvedValue({ data });
    const onDrillDown = vi.fn();
    const onOpenTicket = vi.fn();
    render(<RequesterDashboard onDrillDown={onDrillDown} onOpenTicket={onOpenTicket} onCreate={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: /Welcome, Jennifer/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Waiting for Me: 1, view list" }));
    expect(onDrillDown).toHaveBeenCalledWith({ status: "WAITING_FOR_REQUESTER" });

    await userEvent.click(screen.getByText("Laptop fan very loud"));
    expect(onOpenTicket).toHaveBeenCalledWith(4);
    // Status shown as human text (not raw enum, not color only)
    expect(screen.getAllByText("Waiting for Requester").length).toBeGreaterThan(0);
  });

  // UI-05 — AC-16
  it("invites a Requester with no tickets to create one", async () => {
    const zero = { count: 0, filter: {} };
    (api.getRequesterDashboard as any).mockResolvedValue({
      data: { metrics: { openTickets: zero, waitingForMe: zero, resolved: zero, closed: zero }, needsAttention: [], recentlyUpdated: [], recentlyResolved: [] },
    });
    const onCreate = vi.fn();
    render(<RequesterDashboard onDrillDown={vi.fn()} onOpenTicket={vi.fn()} onCreate={onCreate} />);
    expect(await screen.findByText(/haven't raised any tickets yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Nothing needs your attention/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Create Ticket$/ }));
    expect(onCreate).toHaveBeenCalled();
  });
});
