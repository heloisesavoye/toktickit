import type { ReactNode } from "react";
import { useRequester } from "../context/RequesterContext";

type Page = "my-tickets" | "create-ticket";

// ui-spec.md §7: app shell with identity display, active-nav indication, Change Requester.
export function AppShell({
  active,
  onNavigate,
  children,
}: {
  active: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}) {
  const { requesterName, changeRequester } = useRequester();

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
        }}
      >
        <strong>TokTickIT</strong>
        <nav style={{ display: "flex", gap: 20 }}>
          <button
            className="btn-tertiary"
            style={{ color: active === "my-tickets" ? "white" : "#CDEBDA", fontWeight: active === "my-tickets" ? 700 : 400 }}
            onClick={() => onNavigate("my-tickets")}
          >
            My Tickets
          </button>
          <button
            className="btn-tertiary"
            style={{ color: active === "create-ticket" ? "white" : "#CDEBDA", fontWeight: active === "create-ticket" ? 700 : 400 }}
            onClick={() => onNavigate("create-ticket")}
          >
            + Create Ticket
          </button>
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>{requesterName}</span>
          <button className="btn btn-secondary" onClick={changeRequester}>
            Change Requester
          </button>
        </div>
      </header>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>{children}</main>
    </div>
  );
}
