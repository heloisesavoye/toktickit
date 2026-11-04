import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StaffTicketDetail } from "../../src/components/StaffTicketDetail";
import { AppShell } from "../../src/components/AppShell";
import { api, ApiError } from "../../src/api/client";

let mockUser: any = { id: 7, name: "Priya Nakamura", role: "IT_STAFF" };
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn() }),
}));
vi.mock("../../src/api/client", async () => {
  const actual = await vi.importActual<any>("../../src/api/client");
  return {
    ...actual,
    api: {
      getStaffTicket: vi.fn(),
      setStatus: vi.fn(),
      listAssignees: vi.fn().mockResolvedValue({ data: [] }),
      claimTicket: vi.fn(),
      setItPriority: vi.fn(),
      postComment: vi.fn(),
      postNote: vi.fn(),
    },
  };
});

const ticket = (o: Record<string, unknown> = {}) => ({
  id: 3,
  ticketNumber: "TKT-2026-000003",
  ticketDate: new Date().toISOString(),
  category: { name: "Hardware" },
  relatedSystem: { name: "Corporate Laptop" },
  requester: { name: "Michael Brown", email: "michael.brown@example.com" },
  ticketOwner: { id: 7, name: "Priya Nakamura" },
  requestedPriority: "MEDIUM",
  itPriority: "LOW",
  currentStatus: "IN_PROGRESS",
  appearsResolved: false,
  summary: "Docking station not detected",
  description: "External monitor stops working when docked.",
  attachments: [],
  comments: [],
  notes: [],
  version: 4,
  actions: [],
  statusHistory: [],
  resolutionGate: { allowed: false, completedActions: 0, openActions: 0, reason: "Record and complete at least one Action Taken before resolving." },
  ...o,
});

describe("Ticket workflow UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.listAssignees as any).mockResolvedValue({ data: [] });
  });

  // UI-10 — AC-19, AC-03
  it("offers only permitted transitions and disables Resolved when the gate is unmet", async () => {
    (api.getStaffTicket as any).mockResolvedValue({ data: ticket() });
    render(<StaffTicketDetail ticketId={3} onBack={vi.fn()} />);
    const select = await screen.findByLabelText(/Current Status/i);
    const values = within(select).getAllByRole("option").map((o) => (o as HTMLOptionElement).value);
    expect(values).toEqual(["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]);
    const resolved = within(select).getByRole("option", { name: /Resolved/ }) as HTMLOptionElement;
    expect(resolved.disabled).toBe(true);
    expect(screen.getByText(/complete at least one Action Taken/i)).toBeInTheDocument();
  });

  // UI-11 — AC-04
  it("sends expectedVersion and refreshes summary + history after a change", async () => {
    (api.getStaffTicket as any)
      .mockResolvedValueOnce({ data: ticket({ resolutionGate: { allowed: true, completedActions: 1, openActions: 0, reason: null } }) })
      .mockResolvedValueOnce({
        data: ticket({
          currentStatus: "RESOLVED",
          version: 5,
          statusHistory: [{ id: 1, fromStatus: "IN_PROGRESS", toStatus: "RESOLVED", changedAt: new Date().toISOString(), changedBy: { name: "Priya Nakamura" } }],
        }),
      });
    (api.setStatus as any).mockResolvedValue({ data: { currentStatus: "RESOLVED", version: 5 } });
    render(<StaffTicketDetail ticketId={3} onBack={vi.fn()} />);

    await userEvent.selectOptions(await screen.findByLabelText(/Current Status/i), "RESOLVED");
    expect(api.setStatus).toHaveBeenCalledWith(3, "RESOLVED", 4);
    expect(await screen.findByText(/Status history/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Current Status/i)).toHaveValue("RESOLVED");
  });

  it("shows the server reason when the change is blocked or stale", async () => {
    (api.getStaffTicket as any).mockResolvedValue({ data: ticket({ currentStatus: "NEW" }) });
    (api.setStatus as any).mockRejectedValue(new ApiError(409, "STALE_UPDATE", undefined, "This ticket was changed by someone else."));
    render(<StaffTicketDetail ticketId={3} onBack={vi.fn()} />);
    await userEvent.selectOptions(await screen.findByLabelText(/Current Status/i), "OPEN");
    expect(await screen.findByRole("alert")).toHaveTextContent(/changed by someone else/i);
  });

  // UI-12 — FR-19, A-02
  it("puts Dashboard first in every role's nav and marks the active page", () => {
    for (const role of ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"]) {
      mockUser = { id: 1, name: "User", role };
      const { unmount } = render(
        <AppShell active="dashboard" onNavigate={vi.fn()}>
          <div />
        </AppShell>
      );
      const nav = screen.getByRole("navigation", { name: "Main" });
      const buttons = within(nav).getAllByRole("button");
      expect(buttons[0]).toHaveTextContent("Dashboard");
      expect(buttons[0]).toHaveAttribute("aria-current", "page");
      expect(buttons[1]).not.toHaveAttribute("aria-current");
      unmount();
    }
  });
});
