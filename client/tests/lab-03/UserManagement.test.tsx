import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserManagement } from "../../src/components/UserManagement";
import { api, ApiError } from "../../src/api/client";

vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, name: "Alex Thompson", role: "ADMINISTRATOR" } }),
}));

vi.mock("../../src/api/client", async () => {
  const actual = await vi.importActual<any>("../../src/api/client");
  return {
    ...actual,
    api: {
      listUsers: vi.fn(),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      setUserPassword: vi.fn(),
    },
  };
});

const selfAdmin = { id: 1, name: "Alex Thompson", email: "admin@toktickit.local", role: "ADMINISTRATOR" as const, isActive: true };
const requester = { id: 2, name: "Jennifer Anderson", email: "jennifer.anderson@example.com", role: "REQUESTER" as const, isActive: true };

describe("UserManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists users and opens the create panel", async () => {
    (api.listUsers as any).mockResolvedValue({ data: [selfAdmin, requester] });
    render(<UserManagement />);

    expect(await screen.findByText("Jennifer Anderson")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /\+ Create User/i }));
    expect(screen.getByText("Create New User")).toBeInTheDocument();
  });

  // FR-21, BR-08: creating forces a password change (server-enforced); the
  // client always sends an initialPassword the user must change later.
  it("submits a new user with the generated initial password", async () => {
    (api.listUsers as any).mockResolvedValue({ data: [selfAdmin] });
    (api.createUser as any).mockResolvedValue({ data: { id: 3 } });
    render(<UserManagement />);

    await userEvent.click(await screen.findByRole("button", { name: /\+ Create User/i }));
    await userEvent.type(screen.getByLabelText(/Full Name/i), "New Staffer");
    await userEvent.type(screen.getByLabelText(/Email Address/i), "new-staffer@example.com");
    await userEvent.selectOptions(screen.getByLabelText(/^Role/i), "IT_STAFF");
    await userEvent.click(screen.getByRole("button", { name: /Save User/i }));

    expect(api.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Staffer", email: "new-staffer@example.com", role: "IT_STAFF" })
    );
  });

  // BR-11: duplicate email surfaces as a field-level error, not a generic one
  it("shows a field error when the email is already in use", async () => {
    (api.listUsers as any).mockResolvedValue({ data: [selfAdmin] });
    (api.createUser as any).mockRejectedValue(new ApiError(409, "EMAIL_IN_USE"));
    render(<UserManagement />);

    await userEvent.click(await screen.findByRole("button", { name: /\+ Create User/i }));
    await userEvent.type(screen.getByLabelText(/Full Name/i), "Dup");
    await userEvent.type(screen.getByLabelText(/Email Address/i), "admin@toktickit.local");
    await userEvent.click(screen.getByRole("button", { name: /Save User/i }));

    expect(await screen.findByText(/already in use/i)).toBeInTheDocument();
  });

  // BR-24: the signed-in Administrator cannot deactivate themselves — the
  // checkbox is disabled with an explanatory note.
  it("disables the Active checkbox for the signed-in Administrator's own row", async () => {
    (api.listUsers as any).mockResolvedValue({ data: [selfAdmin] });
    render(<UserManagement />);

    await userEvent.click(await screen.findByRole("button", { name: /Edit/i }));
    const activeCheckbox = screen.getByLabelText(/Active/i) as HTMLInputElement;
    expect(activeCheckbox).toBeDisabled();
    expect(screen.getByText(/cannot deactivate your own account/i)).toBeInTheDocument();
  });

  it("saves edits to a user's role", async () => {
    (api.listUsers as any).mockResolvedValue({ data: [selfAdmin, requester] });
    (api.updateUser as any).mockResolvedValue({ data: { ...requester, role: "IT_STAFF" } });
    render(<UserManagement />);

    const rows = await screen.findAllByRole("button", { name: /Edit/i });
    await userEvent.click(rows[1]); // requester row
    await userEvent.selectOptions(screen.getByLabelText(/^Role/i), "IT_STAFF");
    await userEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    expect(api.updateUser).toHaveBeenCalledWith(
      requester.id,
      expect.objectContaining({ role: "IT_STAFF" })
    );
  });

  // FR-23, BR-26: forced password reset flow
  it("forces a new initial password for a user", async () => {
    (api.listUsers as any).mockResolvedValue({ data: [selfAdmin, requester] });
    (api.setUserPassword as any).mockResolvedValue({ data: { requiresPasswordChange: true } });
    render(<UserManagement />);

    const rows = await screen.findAllByRole("button", { name: /Edit/i });
    await userEvent.click(rows[1]);
    await userEvent.click(screen.getByRole("button", { name: /Set New Initial Password/i }));
    await userEvent.click(screen.getByRole("button", { name: /Confirm/i }));

    expect(api.setUserPassword).toHaveBeenCalledWith(requester.id, expect.any(String));
  });

  it("shows the no-results callout when the search matches nothing", async () => {
    (api.listUsers as any).mockResolvedValue({ data: [] });
    render(<UserManagement />);
    expect(await screen.findByText(/No users match your search/i)).toBeInTheDocument();
  });
});
