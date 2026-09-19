import { useState } from "react";
import { RequesterProvider, useRequester } from "./context/RequesterContext";
import { RequesterSelection } from "./components/RequesterSelection";
import { AppShell } from "./components/AppShell";
import { CreateTicket } from "./components/CreateTicket";
import { MyTickets } from "./components/MyTickets";
import { RequesterTicketDetail } from "./components/RequesterTicketDetail";
import "./theme/tokens.css";

type Route =
  | { name: "my-tickets" }
  | { name: "create-ticket" }
  | { name: "ticket-detail"; id: number };

function AppInner() {
  const { requesterId } = useRequester();
  const [route, setRoute] = useState<Route>({ name: "my-tickets" });

  // AC-02: no requester selected → Requester Selection screen.
  if (!requesterId) {
    return <RequesterSelection onContinue={() => setRoute({ name: "my-tickets" })} />;
  }

  return (
    <AppShell
      active={route.name === "create-ticket" ? "create-ticket" : "my-tickets"}
      onNavigate={(page) => setRoute({ name: page })}
    >
      {route.name === "my-tickets" && (
        <MyTickets
          onOpen={(id) => setRoute({ name: "ticket-detail", id })}
          onCreate={() => setRoute({ name: "create-ticket" })}
        />
      )}
      {route.name === "create-ticket" && (
        <CreateTicket onCreated={(_num, id) => setRoute({ name: "ticket-detail", id })} />
      )}
      {route.name === "ticket-detail" && (
        <RequesterTicketDetail ticketId={route.id} onBack={() => setRoute({ name: "my-tickets" })} />
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <RequesterProvider>
      <AppInner />
    </RequesterProvider>
  );
}
