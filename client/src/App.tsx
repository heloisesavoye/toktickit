import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Login } from "./components/Login";
import { ChangePassword } from "./components/ChangePassword";
import { AppShell, type Page } from "./components/AppShell";
import { CreateTicket } from "./components/CreateTicket";
import { MyTickets } from "./components/MyTickets";
import { RequesterTicketDetail } from "./components/RequesterTicketDetail";
import { StaffTicketQueue } from "./components/StaffTicketQueue";
import { StaffTicketDetail } from "./components/StaffTicketDetail";
import { UserManagement } from "./components/UserManagement";
import "./theme/tokens.css";

type Route =
  | { name: "my-tickets" }
  | { name: "create-ticket" }
  | { name: "ticket-detail"; id: number }
  | { name: "staff-queue" }
  | { name: "staff-ticket-detail"; id: number }
  | { name: "admin-users" };

function AppInner() {
  const { status, user } = useAuth();
  const [route, setRoute] = useState<Route>({ name: "my-tickets" });

  if (status === "loading") return <p role="status">Loading…</p>;
  if (status === "anonymous" || !user) return <Login />;
  if (user.requiresPasswordChange) return <ChangePassword />;

  // FR-07: default landing route depends on role.
  const homeRoute: Route =
    user.role === "REQUESTER" ? { name: "my-tickets" } : { name: "staff-queue" };
  const effectiveRoute =
    (user.role === "REQUESTER" && ["staff-queue", "staff-ticket-detail", "admin-users"].includes(route.name)) ||
    (user.role !== "REQUESTER" && ["my-tickets", "create-ticket", "ticket-detail"].includes(route.name)) ||
    (user.role !== "ADMINISTRATOR" && route.name === "admin-users")
      ? homeRoute
      : route;

  const activePage: Page =
    effectiveRoute.name === "ticket-detail"
      ? "my-tickets"
      : effectiveRoute.name === "staff-ticket-detail"
      ? "staff-queue"
      : (effectiveRoute.name as Page);

  return (
    <AppShell active={activePage} onNavigate={(page) => setRoute({ name: page } as Route)}>
      {effectiveRoute.name === "my-tickets" && (
        <MyTickets
          onOpen={(id) => setRoute({ name: "ticket-detail", id })}
          onCreate={() => setRoute({ name: "create-ticket" })}
        />
      )}
      {effectiveRoute.name === "create-ticket" && (
        <CreateTicket onCreated={(_num, id) => setRoute({ name: "ticket-detail", id })} />
      )}
      {effectiveRoute.name === "ticket-detail" && (
        <RequesterTicketDetail ticketId={effectiveRoute.id} onBack={() => setRoute({ name: "my-tickets" })} />
      )}
      {effectiveRoute.name === "staff-queue" && (
        <StaffTicketQueue onOpen={(id) => setRoute({ name: "staff-ticket-detail", id })} />
      )}
      {effectiveRoute.name === "staff-ticket-detail" && (
        <StaffTicketDetail ticketId={effectiveRoute.id} onBack={() => setRoute({ name: "staff-queue" })} />
      )}
      {effectiveRoute.name === "admin-users" && <UserManagement />}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
