import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { Badge } from "./ui/Badge";

export type Page = "my-tickets" | "create-ticket" | "staff-queue" | "admin-users";

const ROLE_BADGE: Record<string, { label: string }> = {
  REQUESTER: { label: "Requester" },
  IT_STAFF: { label: "IT Staff" },
  ADMINISTRATOR: { label: "Administrator" },
};

// ui-spec.md §4: role-specific nav (FR-07); every route is still enforced
// server-side regardless of what's rendered here (FR-08).
export function AppShell({
  active,
  onNavigate,
  children,
}: {
  active: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  if (!user) return null;

  const navItems: { page: Page; label: string }[] =
    user.role === "REQUESTER"
      ? [
          { page: "my-tickets", label: "My Tickets" },
          { page: "create-ticket", label: "+ Create Ticket" },
        ]
      : user.role === "IT_STAFF"
      ? [{ page: "staff-queue", label: "Ticket Queue" }]
      : [
          { page: "staff-queue", label: "Ticket Queue" },
          { page: "admin-users", label: "Admin" },
        ];

  return (
    <div>
      <header
        style={{
          background: "var(--color-primary)",
          color: "white",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <strong>TokTickIT</strong>
        <nav style={{ display: "flex", gap: 20 }}>
          {navItems.map((item) => (
            <button
              key={item.page}
              className="btn-tertiary"
              style={{
                color: active === item.page ? "white" : "#CDEBDA",
                fontWeight: active === item.page ? 700 : 400,
              }}
              onClick={() => onNavigate(item.page)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>{user.name}</span>
          <Badge label={ROLE_BADGE[user.role].label} variant="status" />
          <button className="btn btn-secondary" onClick={() => logout()}>
            Logout
          </button>
        </div>
      </header>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>{children}</main>
    </div>
  );
}
