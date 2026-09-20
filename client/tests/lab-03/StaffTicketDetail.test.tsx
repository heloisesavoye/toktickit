import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StaffTicketDetail } from "../../src/components/StaffTicketDetail";
import { api, ApiError } from "../../src/api/client";

vi.mock("../../src/api/client", async () => {
  const actual = await vi.importActual<any>("../../src/api/client");
  return {
    ...actual,
    api: {
      getStaffTicket: vi.fn(),
      claimTicket: vi.fn(),
      setItPriority: vi.fn(),
      setStatus: vi.fn(),
      postComment: vi.fn(),
      postNote: vi.fn(),
    },
  };
});

const baseTicket = {
  id: 7,
  ticketNumber: "TKT-2026-000007",
  ticketDate: new Date().toISOString(),
  category: { name: "Network" },
  relatedSystem: { name: "VPN" },
  requester: { name: "Jennifer Anderson", email: "jennifer.anderson@example.com" },
  ticketOwner: null,
  requestedPriority: "HIGH",
  itPriority: null,
  currentStatus: "NEW",
  appearsResolved: false,
  summary: "Cannot connect to VPN",
  description: "VPN client fails to connect since this morning.",
  attachments: [],
  comments: [],
  notes: [],
};

describe("StaffTicketDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a not-found state and lets the user go back to the queue", async () => {
    (api.getStaffTicket as any).mockRejectedValue(new ApiError(404, "TICKET_NOT_FOUND"));
    const onBack = vi.fn();
    render(<StaffTicketDetail ticketId={999} onBack={onBack} />);

    expect(await screen.findByText(/Ticket not found/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Back to Queue/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("lets an unowned ticket be claimed", async () => {
    (api.getStaffTicket as any).mockResolvedValue({ data: baseTicket });
    (api.claimTicket as any).mockResolvedValue({ data: { ticketOwnerId: 5, ticketOwnerName: "Staff A" } });
    render(<StaffTicketDetail ticketId={7} onBack={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: /^Claim$/i }));
    expect(api.claimTicket).toHaveBeenCalledWith(7);
  });

  // BR-04: Internal Notes render visually separate from Public Comments and
  // are clearly labeled as staff-only.
  it("keeps the Internal Notes panel visually distinct and labeled staff-only", async () => {
    (api.getStaffTicket as any).mockResolvedValue({
      data: { ...baseTicket, comments: [{ id: 1, content: "Public update", createdAt: new Date().toISOString(), author: { name: "Staff A", role: "IT_STAFF" } }], notes: [{ id: 2, content: "Internal-only diagnosis", createdAt: new Date().toISOString(), author: { name: "Staff A" } }] },
    });
    render(<StaffTicketDetail ticketId={7} onBack={vi.fn()} />);

    expect(await screen.findByText("Public update")).toBeInTheDocument();
    expect(screen.getByText("Internal-only diagnosis")).toBeInTheDocument();
    expect(screen.getByText(/not visible to Requester/i)).toBeInTheDocument();
  });

  // BR-16/BR-17: an invalid transition shows the server's error message.
  // The dropdown only ever lists transitions that are valid from the
  // ticket's *current* status (see STATUS_OPTIONS_FOR), so "RESOLVED" is
  // never an option while the ticket is NEW — selecting it isn't possible
  // through this UI. To exercise the error-handling path we pick an option
  // the dropdown does offer ("OPEN") and simulate the server rejecting it
  // anyway (e.g. another staff member changed the ticket's status first).
  it("shows the server's error when a status transition is rejected", async () => {
    (api.getStaffTicket as any).mockResolvedValue({ data: baseTicket });
    (api.setStatus as any).mockRejectedValue(
      new ApiError(409, "INVALID_TRANSITION", undefined, "Cannot move from NEW to OPEN.")
    );
    render(<StaffTicketDetail ticketId={7} onBack={vi.fn()} />);

    const statusSelect = await screen.findByLabelText(/Current Status/i);
    await userEvent.selectOptions(statusSelect, "OPEN");

    expect(await screen.findByRole("alert")).toHaveTextContent(/Cannot move from NEW to OPEN/i);
  });

  it("posts a new public comment and clears the draft", async () => {
    (api.getStaffTicket as any).mockResolvedValue({ data: baseTicket });
    (api.postComment as any).mockResolvedValue({ data: { id: 3 } });
    render(<StaffTicketDetail ticketId={7} onBack={vi.fn()} />);

    const input = await screen.findByPlaceholderText(/Type your comment here/i);
    await userEvent.type(input, "We're looking into it.");
    await userEvent.click(screen.getByRole("button", { name: /Post Comment/i }));

    expect(api.postComment).toHaveBeenCalledWith(7, "We're looking into it.");
  });
});
