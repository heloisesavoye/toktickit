import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangePassword } from "../../src/components/ChangePassword";
import { api, ApiError } from "../../src/api/client";

const mockRefresh = vi.fn();
const mockLogout = vi.fn();

vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({ refresh: mockRefresh, logout: mockLogout }),
}));

vi.mock("../../src/api/client", async () => {
  const actual = await vi.importActual<any>("../../src/api/client");
  return { ...actual, api: { changePassword: vi.fn() } };
});

describe("ChangePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // UI-06 / AC-19: the live checklist reflects the password policy (BR-08)
  it("keeps Continue disabled until the policy and confirmation both pass", async () => {
    render(<ChangePassword />);
    const submit = screen.getByRole("button", { name: /continue/i });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Current \(temporary\) password/i), "Temp1234!");
    await userEvent.type(screen.getByLabelText(/^New password/i), "weak");
    expect(submit).toBeDisabled();

    await userEvent.clear(screen.getByLabelText(/^New password/i));
    await userEvent.type(screen.getByLabelText(/^New password/i), "NewStrongPass1!");
    expect(submit).toBeDisabled(); // confirmation doesn't match yet

    await userEvent.type(screen.getByLabelText(/Confirm new password/i), "NewStrongPass1!");
    expect(submit).toBeEnabled();
  });

  it("submits the current and new password and refreshes the session", async () => {
    (api.changePassword as any).mockResolvedValue({ data: { requiresPasswordChange: false } });
    render(<ChangePassword />);

    await userEvent.type(screen.getByLabelText(/Current \(temporary\) password/i), "Temp1234!");
    await userEvent.type(screen.getByLabelText(/^New password/i), "NewStrongPass1!");
    await userEvent.type(screen.getByLabelText(/Confirm new password/i), "NewStrongPass1!");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(api.changePassword).toHaveBeenCalledWith("Temp1234!", "NewStrongPass1!");
    expect(mockRefresh).toHaveBeenCalled();
  });

  // AC-20: a wrong current password shows a specific, safe error
  it("shows a specific error when the current password is wrong (401)", async () => {
    (api.changePassword as any).mockRejectedValue(new ApiError(401, "INVALID_CREDENTIALS"));
    render(<ChangePassword />);

    await userEvent.type(screen.getByLabelText(/Current \(temporary\) password/i), "WrongOne1!");
    await userEvent.type(screen.getByLabelText(/^New password/i), "NewStrongPass1!");
    await userEvent.type(screen.getByLabelText(/Confirm new password/i), "NewStrongPass1!");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Current password is incorrect/i);
  });

  it("lets the user cancel and sign out", async () => {
    render(<ChangePassword />);
    await userEvent.click(screen.getByRole("button", { name: /cancel and sign out/i }));
    expect(mockLogout).toHaveBeenCalled();
  });
});
