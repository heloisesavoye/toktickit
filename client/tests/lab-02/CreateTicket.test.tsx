import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateTicket } from "../../src/components/CreateTicket";
import { RequesterProvider } from "../../src/context/RequesterContext";
import { api } from "../../src/api/client";

vi.mock("../../src/api/client", async () => {
  const actual = await vi.importActual<any>("../../src/api/client");
  return {
    ...actual,
    api: {
      getCategories: vi.fn().mockResolvedValue({ data: [{ id: 1, name: "Hardware" }] }),
      getRelatedSystems: vi.fn().mockResolvedValue({ data: [{ id: 1, name: "Corporate Laptop" }] }),
      createTicket: vi.fn(),
      uploadAttachment: vi.fn(),
    },
  };
});

function renderWithRequester() {
  localStorage.setItem("toktickit.devRequester", JSON.stringify({ id: 1, name: "Jennifer Anderson" }));
  return render(
    <RequesterProvider>
      <CreateTicket onCreated={vi.fn()} />
    </RequesterProvider>
  );
}

describe("CreateTicket", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // UI-02 / AC-04: blank summary shows a field error and does not call the API
  it("shows a field error and does not call the API when Summary is blank", async () => {
    renderWithRequester();
    await screen.findByLabelText(/Requester/i);

    const submit = await screen.findByRole("button", { name: /submit ticket/i });
    await userEvent.click(submit);

    expect(await screen.findByText(/Summary must be/i)).toBeInTheDocument();
    expect(api.createTicket).not.toHaveBeenCalled();
  });

  // UI-03: busy state while submitting
  it("shows a busy Submit button while the create request is pending", async () => {
    let resolveCreate: (v: any) => void = () => {};
    (api.createTicket as any).mockReturnValue(
      new Promise((resolve) => { resolveCreate = resolve; })
    );

    renderWithRequester();
    await screen.findByLabelText(/Requester/i);

    await userEvent.type(screen.getByLabelText(/Ticket Summary/i), "Laptop battery drains quickly");
    await userEvent.type(screen.getByLabelText(/Description/i), "The battery drains fast even when idle.");
    await userEvent.click(screen.getByRole("button", { name: /submit ticket/i }));

    expect(await screen.findByRole("button", { name: /submitting/i })).toBeDisabled();

    resolveCreate({ data: { id: 1, ticketNumber: "TKT-2026-000001" } });
  });

  // UI-04 / AC-05: API failure preserves entered values
  it("shows a safe error and preserves field values when the API call fails", async () => {
    (api.createTicket as any).mockRejectedValue(new Error("network error"));

    renderWithRequester();
    await screen.findByLabelText(/Requester/i);

    const summaryInput = screen.getByLabelText(/Ticket Summary/i);
    await userEvent.type(summaryInput, "Laptop battery drains quickly");
    await userEvent.type(screen.getByLabelText(/Description/i), "The battery drains fast even when idle.");
    await userEvent.click(screen.getByRole("button", { name: /submit ticket/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect((summaryInput as HTMLInputElement).value).toBe("Laptop battery drains quickly");
  });
});
