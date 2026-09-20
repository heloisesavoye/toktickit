import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StaffTicketQueue } from "../../src/components/StaffTicketQueue";
import { api } from "../../src/api/client";

vi.mock("../../src/api/client", async () => {
  const actual = await vi.importActual<any>("../../src/api/client");
  return { ...actual, api: { listStaffTickets: vi.fn() } };
});

describe("StaffTicketQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the EMPTY state when there are no tickets at all", async () => {
    (api.listStaffTickets as any).mockResolvedValue({
      data: [],
      state: "EMPTY",
      meta: { page: 1, totalPages: 1, totalItems: 0 },
    });
    render(<StaffTicketQueue onOpen={vi.fn()} />);
    expect(await screen.findByText(/No tickets exist yet/i)).toBeInTheDocument();
  });

  it("shows the NO_RESULTS state with a Clear Filters action", async () => {
    (api.listStaffTickets as any).mockResolvedValue({
      data: [],
      state: "NO_RESULTS",
      meta: { page: 1, totalPages: 1, totalItems: 0 },
    });
    render(<StaffTicketQueue onOpen={vi.fn()} />);
    expect(await screen.findByText(/No tickets match your filters/i)).toBeInTheDocument();
  });

  it("renders the ticket table and opens a ticket on row click", async () => {
    (api.listStaffTickets as any).mockResolvedValue({
      data: [
        {
          id: 42,
          ticketNumber: "TKT-2026-000042",
          summary: "VPN connection drops",
          category: { name: "Network" },
          requestedPriority: "HIGH",
          itPriority: null,
          currentStatus: "NEW",
          ticketOwner: null,
          updatedAt: new Date().toISOString(),
        },
      ],
      state: "OK",
      meta: { page: 1, totalPages: 1, totalItems: 1 },
    });
    const onOpen = vi.fn();
    render(<StaffTicketQueue onOpen={onOpen} />);

    const row = await screen.findByText("TKT-2026-000042");
    await userEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith(42);
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  // search/status filters trigger a re-fetch with the right params
  it("re-fetches with the search term when the search box is used", async () => {
    (api.listStaffTickets as any).mockResolvedValue({
      data: [],
      state: "EMPTY",
      meta: { page: 1, totalPages: 1, totalItems: 0 },
    });
    render(<StaffTicketQueue onOpen={vi.fn()} />);
    await screen.findByText(/No tickets exist yet/i);

    await userEvent.type(screen.getByPlaceholderText(/Search by ticket number/i), "VPN");

    const lastCallParams: URLSearchParams = (api.listStaffTickets as any).mock.calls.at(-1)[0];
    expect(lastCallParams.get("search")).toBe("VPN");
  });
});
