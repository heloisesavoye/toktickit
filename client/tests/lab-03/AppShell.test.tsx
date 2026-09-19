import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "../../src/components/AppShell";

let mockUser: any = null;
const mockLogout = vi.fn();

vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, logout: mockLogout }),
}));

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // UI-04 / FR-07: Requester nav shows only their own screens
  it("shows Requester nav items for a REQUESTER user", () => {
    mockUser = { id: 1, name: "Jennifer Anderson", role: "REQUESTER" };
    render(
      <AppShell active="my-tickets" onNavigate={vi.fn()}>
        <div>content</div>
      </AppShell>
    );
    expect(screen.getByRole("button", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Create Ticket" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ticket Queue" })).not.toBeInTheDocument();
    expect(screen.getByText("Requester")).toBeInTheDocument();
  });

  it("shows only the Ticket Queue for an IT_STAFF user (no Admin link)", () => {
    mockUser = { id: 2, name: "Priya Nakamura", role: "IT_STAFF" };
    render(
      <AppShell active="staff-queue" onNavigate={vi.fn()}>
        <div>content</div>
      </AppShell>
    );
    expect(screen.getByRole("button", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Admin" })).not.toBeInTheDocument();
    expect(screen.getByText("IT Staff")).toBeInTheDocument();
  });

  // FR-07: Administrator sees both the queue and Admin
  it("shows Ticket Queue and Admin for an ADMINISTRATOR user", () => {
    mockUser = { id: 3, name: "Alex Thompson", role: "ADMINISTRATOR" };
    render(
      <AppShell active="admin-users" onNavigate={vi.fn()}>
        <div>content</div>
      </AppShell>
    );
    expect(screen.getByRole("button", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
  });

  it("calls onNavigate when a nav item is clicked", async () => {
    mockUser = { id: 1, name: "Jennifer Anderson", role: "REQUESTER" };
    const onNavigate = vi.fn();
    render(
      <AppShell active="my-tickets" onNavigate={onNavigate}>
        <div>content</div>
      </AppShell>
    );
    await userEvent.click(screen.getByRole("button", { name: "+ Create Ticket" }));
    expect(onNavigate).toHaveBeenCalledWith("create-ticket");
  });

  it("calls logout when Logout is clicked", async () => {
    mockUser = { id: 1, name: "Jennifer Anderson", role: "REQUESTER" };
    render(
      <AppShell active="my-tickets" onNavigate={vi.fn()}>
        <div>content</div>
      </AppShell>
    );
    await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(mockLogout).toHaveBeenCalled();
  });

  it("renders nothing when there is no authenticated user", () => {
    mockUser = null;
    const { container } = render(
      <AppShell active="my-tickets" onNavigate={vi.fn()}>
        <div>content</div>
      </AppShell>
    );
    expect(container).toBeEmptyDOMElement();
  });
});
