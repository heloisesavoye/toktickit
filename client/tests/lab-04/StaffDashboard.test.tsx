import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StaffDashboard } from "../../src/components/dashboard/StaffDashboard";
import { api, ApiError } from "../../src/api/client";

vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: 7, name: "Priya Nakamura", role: "IT_STAFF" } }),
}));
vi.mock("../../src/api/client", async () => {
  const actual = await vi.importActual<any>("../../src/api/client");
  return { ...actual, api: { getStaffDashboard: vi.fn() } };
});

const data = {
  metrics: {
    unassigned: { count: 4, filter: { ownerId: "unassigned", status: "ACTIVE" } },
    new: { count: 2, filter: { status: "NEW" } },
    inProgress: { count: 3, filter: { status: "IN_PROGRESS" } },
    waitingForRequester: { count: 1, filter: { status: "WAITING_FOR_REQUESTER" } },
    myAssigned: { count: 5, filter: { ownerId: "7", status: "ACTIVE" } },
  },
  byStatus: { NEW: 2, OPEN: 1, IN_PROGRESS: 3, WAITING_FOR_REQUESTER: 1, RESOLVED: 2, CLOSED: 1, REOPENED: 0, CANCELLED: 1 },
  byItPriority: { HIGH: 2, MEDIUM: 3, LOW: 1, UNSET: 1 },
  myOpenActions: { count: 1, items: [{ id: 1, ticketId: 9, ticketNumber: "TKT-2026-000009", description: "Call vendor", actionAt: new Date().toISOString(), followUpRequired: true }] },
  urgent: [{ id: 5, ticketNumber: "TKT-2026-000005", summary: "Outlook password loop", currentStatus: "NEW", updatedAt: new Date().toISOString() }],
  recentlyUpdated: [],
};

describe("StaffDashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  // UI-01 — FR-16, AC-15
  it("renders metric cards and drills down with the card's filter", async () => {
    (api.getStaffDashboard as any).mockResolvedValue({ data });
    const onDrillDown = vi.fn();
    render(<StaffDashboard onDrillDown={onDrillDown} onOpenTicket={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: /Welcome back, Priya/i })).toBeInTheDocument();
    const card = screen.getByRole("button", { name: "Unassigned: 4, view list" });
    await userEvent.click(card);
    expect(onDrillDown).toHaveBeenCalledWith({ ownerId: "unassigned", status: "ACTIVE" });
    expect(screen.getByRole("button", { name: "My Assigned: 5, view list" })).toBeInTheDocument();
    expect(screen.getByText("Call vendor")).toBeInTheDocument();
    expect(screen.getByText("Follow-up")).toBeInTheDocument();
  });

  it("opens a ticket from the urgent list", async () => {
    (api.getStaffDashboard as any).mockResolvedValue({ data });
    const onOpenTicket = vi.fn();
    render(<StaffDashboard onDrillDown={vi.fn()} onOpenTicket={onOpenTicket} />);
    await userEvent.click(await screen.findByText("Outlook password loop"));
    expect(onOpenTicket).toHaveBeenCalledWith(5);
  });

  // UI-02 — AC-16 and safe failure
  it("shows empty hints and a retry on failure", async () => {
    (api.getStaffDashboard as any).mockResolvedValueOnce({ data: { ...data, urgent: [], myOpenActions: { count: 0, items: [] } } });
    const { unmount } = render(<StaffDashboard onDrillDown={vi.fn()} onOpenTicket={vi.fn()} />);
    expect(await screen.findByText(/No updates in the last 7 days/i)).toBeInTheDocument();
    expect(screen.getByText(/No open actions assigned to you/i)).toBeInTheDocument();
    expect(screen.getByText(/No active high-priority tickets/i)).toBeInTheDocument();
    unmount();

    (api.getStaffDashboard as any).mockRejectedValueOnce(new ApiError(500, "INTERNAL_ERROR"));
    render(<StaffDashboard onDrillDown={vi.fn()} onOpenTicket={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't load the dashboard/i);
    (api.getStaffDashboard as any).mockResolvedValueOnce({ data });
    await userEvent.click(screen.getByRole("button", { name: /Try again/i }));
    expect(await screen.findByRole("button", { name: "New: 2, view list" })).toBeInTheDocument();
  });

  it("shows a forbidden state on 403", async () => {
    (api.getStaffDashboard as any).mockRejectedValue(new ApiError(403, "FORBIDDEN"));
    render(<StaffDashboard onDrillDown={vi.fn()} onOpenTicket={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/don't have access/i);
  });

  // UI-03 — AC-17
  it("shows Active users only when userCounts is present", async () => {
    (api.getStaffDashboard as any).mockResolvedValue({ data });
    const { unmount } = render(<StaffDashboard onDrillDown={vi.fn()} onOpenTicket={vi.fn()} />);
    await screen.findByRole("heading", { name: /Welcome back/i });
    expect(screen.queryByRole("heading", { name: /Active users/i })).not.toBeInTheDocument();
    unmount();

    (api.getStaffDashboard as any).mockResolvedValue({ data: { ...data, userCounts: { REQUESTER: 4, IT_STAFF: 3, ADMINISTRATOR: 1 } } });
    const onOpenUsers = vi.fn();
    render(<StaffDashboard onDrillDown={vi.fn()} onOpenTicket={vi.fn()} onOpenUsers={onOpenUsers} />);
    expect(await screen.findByRole("heading", { name: /Active users/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Manage users/i }));
    expect(onOpenUsers).toHaveBeenCalled();
  });
});
