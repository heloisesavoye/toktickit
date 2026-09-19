import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Login } from "../../src/components/Login";

const mockLogin = vi.fn();
let mockLoginError: string | null = null;

vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
    loginError: mockLoginError,
  }),
}));

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoginError = null;
  });

  // UI-01 / AC-14: submits the entered credentials
  it("calls login with the entered email and password on submit", async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<Login />);

    await userEvent.type(screen.getByLabelText(/Email address/i), "requester@example.com");
    await userEvent.type(screen.getByLabelText(/Password/i), "TestDev123!");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(mockLogin).toHaveBeenCalledWith("requester@example.com", "TestDev123!");
  });

  // UI-01 / AC-15, BR-06: a generic error is shown, never which part was wrong
  it("shows the generic login error banner from context", () => {
    mockLoginError = "Invalid email or password. Please try again.";
    render(<Login />);
    expect(screen.getByRole("alert")).toHaveTextContent(/Invalid email or password/i);
  });

  it("toggles password visibility", async () => {
    render(<Login />);
    const passwordInput = screen.getByLabelText(/^Password/i) as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    await userEvent.click(screen.getByRole("button", { name: /show password/i }));
    expect(passwordInput.type).toBe("text");
  });
});
