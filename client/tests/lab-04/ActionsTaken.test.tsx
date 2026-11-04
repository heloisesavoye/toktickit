import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionsTaken, type Action } from "../../src/components/ActionsTaken";
import { api, ApiError } from "../../src/api/client";

vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: 7, name: "Priya Nakamura", role: "IT_STAFF" } }),
}));
vi.mock("../../src/api/client", async () => {
  const actual = await vi.importActual<any>("../../src/api/client");
  return {
    ...actual,
    api: {
      listAssignees: vi.fn(),
      createAction: vi.fn(),
      updateAction: vi.fn(),
      completeAction: vi.fn(),
      cancelAction: vi.fn(),
    },
  };
});

const action = (o: Partial<Action> = {}): Action => ({
  id: 1, ticketId: 3, actionAt: new Date().toISOString(),
  description: "Re-seated the dock cable", result: "Monitor detected",
  performedBy: { id: 7, name: "Priya Nakamura" }, assignee: { id: 7, name: "Priya Nakamura" },
  followUpRequired: false, followUpNote: null, attachmentNotes: null,
  status: "OPEN", completedAt: null, cancelledAt: null, version: 1, ...o,
});

async function fillValid() {
  await userEvent.type(screen.getByLabelText(/Action Description/i), "Restarted VPN service");
  await userEvent.type(screen.getByLabelText(/^Result/i), "Client reconnects");
}

describe("ActionsTaken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.listAssignees as any).mockResolvedValue({
      data: [{ id: 7, name: "Priya Nakamura", role: "IT_STAFF" }, { id: 8, name: "Emma Wilson", role: "IT_STAFF" }],
    });
  });

  it("lists actions with performer, assignee and status text", () => {
    render(<ActionsTaken ticketId={3} actions={[action(), action({ id: 2, status: "COMPLETED", assignee: { id: 8, name: "Emma Wilson" } })]} ticketFinal={false} onChanged={vi.fn()} />);
    expect(screen.getAllByText("Re-seated the dock cable")).toHaveLength(2);
    expect(screen.getByText("Emma Wilson")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("shows an empty state and disables Add on a closed ticket", () => {
    render(<ActionsTaken ticketId={3} actions={[]} ticketFinal onChanged={vi.fn()} />);
    expect(screen.getByText(/No actions recorded yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add action/i })).toBeDisabled();
  });

  // UI-06 — AC-05
  it("requires a follow-up note only when follow-up is Yes", async () => {
    render(<ActionsTaken ticketId={3} actions={[]} ticketFinal={false} onChanged={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Add action/i }));
    expect(screen.queryByLabelText(/Follow-up Note/i)).not.toBeInTheDocument();
    await fillValid();
    await userEvent.click(screen.getByLabelText("Yes"));
    expect(screen.getByLabelText(/Follow-up Note/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Save action/i }));
    expect(await screen.findByText(/Follow-up note is required/i)).toBeInTheDocument();
    expect(api.createAction).not.toHaveBeenCalled();
  });

  // UI-07 — AC-23
  it("sends only one create request on double click and shows Saving…", async () => {
    let resolve!: (v: unknown) => void;
    (api.createAction as any).mockImplementation(() => new Promise((r) => (resolve = r)));
    const onChanged = vi.fn();
    render(<ActionsTaken ticketId={3} actions={[]} ticketFinal={false} onChanged={onChanged} />);
    await userEvent.click(screen.getByRole("button", { name: /Add action/i }));
    await fillValid();
    await screen.findByRole("option", { name: "Emma Wilson" }); // assignees load async
    await userEvent.selectOptions(screen.getByLabelText(/Assignee/i), "8");
    const save = screen.getByRole("button", { name: /Save action/i });
    await userEvent.dblClick(save);
    expect(api.createAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Saving…/i })).toBeDisabled();
    expect((api.createAction as any).mock.calls[0][1]).toMatchObject({
      description: "Restarted VPN service",
      result: "Client reconnects",
      assigneeId: 8,
      followUpRequired: false,
    });
    resolve({ data: action() });
    expect(await screen.findByRole("status")).toHaveTextContent(/Action saved/i);
    expect(onChanged).toHaveBeenCalled();
  });

  // UI-08 — AC-09, AC-24
  it("keeps entered values on STALE_UPDATE and on a server failure", async () => {
    (api.updateAction as any).mockRejectedValueOnce(new ApiError(409, "STALE_UPDATE"));
    render(<ActionsTaken ticketId={3} actions={[action()]} ticketFinal={false} onChanged={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /View or edit action/i }));
    const result = screen.getByLabelText(/^Result/i);
    await userEvent.clear(result);
    await userEvent.type(result, "My new result");
    await userEvent.click(screen.getByRole("button", { name: /Save changes/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Someone else changed this action/i);
    expect(screen.getByLabelText(/^Result/i)).toHaveValue("My new result");
    expect((api.updateAction as any).mock.calls[0][1]).toMatchObject({ version: 1, result: "My new result" });

    (api.updateAction as any).mockRejectedValueOnce(new Error("network down"));
    await userEvent.click(screen.getByRole("button", { name: /Save changes/i }));
    expect(await screen.findByText(/Your entries are kept/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Result/i)).toHaveValue("My new result");
  });

  // UI-09 — AC-11
  it("opens completed actions read-only without Complete/Cancel", async () => {
    render(<ActionsTaken ticketId={3} actions={[action({ status: "COMPLETED", completedAt: new Date().toISOString() })]} ticketFinal={false} onChanged={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /View or edit action/i }));
    expect(screen.getByLabelText(/Action Description/i)).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: /Mark completed/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancel action/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save changes/i })).not.toBeInTheDocument();
  });

  it("completes an open action with its version, and cancel asks for confirmation", async () => {
    (api.completeAction as any).mockResolvedValue({ data: action({ status: "COMPLETED" }) });
    (api.cancelAction as any).mockResolvedValue({ data: action({ status: "CANCELLED" }) });
    const onChanged = vi.fn();
    const { rerender } = render(<ActionsTaken ticketId={3} actions={[action({ version: 4 })]} ticketFinal={false} onChanged={onChanged} />);
    await userEvent.click(screen.getByRole("button", { name: /View or edit action/i }));
    await userEvent.click(screen.getByRole("button", { name: /Mark completed/i }));
    expect(api.completeAction).toHaveBeenCalledWith(1, 4);

    rerender(<ActionsTaken ticketId={3} actions={[action({ id: 2, version: 2 })]} ticketFinal={false} onChanged={onChanged} />);
    await userEvent.click(screen.getByRole("button", { name: /View or edit action/i }));
    await userEvent.click(screen.getByRole("button", { name: /Cancel action/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/Cancel this action/i);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.cancelAction).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Cancel action/i }));
    const cancelButtons = screen.getAllByRole("button", { name: /Cancel action/i });
    const confirm = cancelButtons[cancelButtons.length - 1]; // the dialog's button
    await userEvent.click(confirm);
    expect(api.cancelAction).toHaveBeenCalledWith(2, 2);
  });

  it("shows server field errors such as INVALID_ASSIGNEE", async () => {
    (api.createAction as any).mockRejectedValue(new ApiError(400, "INVALID_ASSIGNEE", { assigneeId: "Assignee must be an active IT Staff member or Administrator" }));
    render(<ActionsTaken ticketId={3} actions={[]} ticketFinal={false} onChanged={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Add action/i }));
    await fillValid();
    await userEvent.click(screen.getByRole("button", { name: /Save action/i }));
    expect(await screen.findByText(/must be an active IT Staff member/i)).toBeInTheDocument();
  });
});
