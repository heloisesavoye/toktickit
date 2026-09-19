import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MyTickets } from "../../src/components/MyTickets";
import { RequesterProvider } from "../../src/context/RequesterContext";
import { api } from "../../src/api/client";

vi.mock("../../src/api/client", async () => {
  const actual = await vi.importActual<any>("../../src/api/client");
  return { ...actual, api: { listTickets: vi.fn() } };
});

function renderWithRequester() {
  localStorage.setItem("toktickit.devRequester", JSON.stringify({ id: 1, name: "Jennifer Anderson" }));
  return render(
    <RequesterProvider>
      <MyTickets onOpen={vi.fn()} onCreate={vi.fn()} />
    </RequesterProvider>
  );
}

describe("MyTickets", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // UI-05 / AC-08: EMPTY state distinct from NO_RESULTS
  it("shows the empty-state CTA when the requester has never created a ticket", async () => {
    (api.listTickets as any).mockResolvedValue({
      data: [],
      state: "EMPTY",
      meta: { page: 1, totalPages: 1, totalItems: 0 },
    });
    renderWithRequester();
    expect(await screen.findByText(/haven't created any tickets yet/i)).toBeInTheDocument();
  });

  // UI-05 / AC-09
  it("shows the no-results state with a clear-filters action when filters match nothing", async () => {
    (api.listTickets as any).mockResolvedValue({
      data: [],
      state: "NO_RESULTS",
      meta: { page: 1, totalPages: 1, totalItems: 0 },
    });
    renderWithRequester();
    expect(await screen.findByText(/No tickets match your filters/i)).toBeInTheDocument();
  });

  it("renders the ticket table when results exist", async () => {
    (api.listTickets as any).mockResolvedValue({
      data: [
        {
          id: 1,
          ticketNumber: "TKT-2026-000001",
          summary: "Laptop battery drains quickly",
          category: { name: "Hardware" },
          requestedPriority: "MEDIUM",
          itPriority: null,
          currentStatus: "NEW",
          updatedAt: new Date().toISOString(),
        },
      ],
      state: "OK",
      meta: { page: 1, totalPages: 1, totalItems: 1 },
    });
    renderWithRequester();
    expect(await screen.findByText("TKT-2026-000001")).toBeInTheDocument();
  });
});
