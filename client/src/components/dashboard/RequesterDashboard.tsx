import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/Button";
import { MetricCard, TicketRow } from "./MetricCard";
import type { ListFilter } from "../../lib/labels";

type Summary = { id: number; ticketNumber: string; summary: string; currentStatus: string; updatedAt: string };
type Metric = { count: number; filter: ListFilter };
type RequesterDashboardData = {
  metrics: Record<"openTickets" | "waitingForMe" | "resolved" | "closed", Metric>;
  needsAttention: Summary[];
  recentlyUpdated: Summary[];
  recentlyResolved: Summary[];
};

const CARDS: { key: keyof RequesterDashboardData["metrics"]; label: string }[] = [
  { key: "openTickets", label: "My Open Tickets" },
  { key: "waitingForMe", label: "Waiting for Me" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];

// Lab 4 Requester dashboard (ui-spec.md §2, FR-15). Only the session
// Requester's own data is ever returned by the API (BR-18).
export function RequesterDashboard({
  onDrillDown,
  onOpenTicket,
  onCreate,
}: {
  onDrillDown: (filter: ListFilter) => void;
  onOpenTicket: (id: number) => void;
  onCreate: () => void;
}) {
  const { user } = useAuth();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<RequesterDashboardData | null>(null);

  function load() {
    setState("loading");
    api
      .getRequesterDashboard()
      .then((res) => {
        setData(res.data);
        setState("ready");
      })
      .catch(() => setState("error"));
  }
  useEffect(load, []);

  if (state === "loading") return <p role="status">Loading dashboard…</p>;
  if (state === "error" || !data) {
    return (
      <div className="callout callout-error" role="alert">
        Couldn't load your dashboard. <Button variant="tertiary" onClick={load}>Try again</Button>
      </div>
    );
  }

  const total = Object.values(data.metrics).reduce((n, m) => n + m.count, 0);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Welcome, {user?.name?.split(" ")[0]}!</h1>
          <p>Here's the latest on your requests.</p>
        </div>
        <Button variant="secondary" onClick={load}>Refresh</Button>
      </div>

      {total === 0 && data.recentlyUpdated.length === 0 && (
        <div className="callout" style={{ marginBottom: 16 }}>
          You haven't raised any tickets yet.{" "}
          <Button variant="primary" onClick={onCreate}>Create Ticket</Button>
        </div>
      )}

      <div className="metric-grid metric-grid-4">
        {CARDS.map((c) => (
          <MetricCard
            key={c.key}
            label={c.label}
            count={data.metrics[c.key].count}
            onOpen={() => onDrillDown(data.metrics[c.key].filter)}
          />
        ))}
      </div>

      <div className="dashboard-columns">
        <div className="dashboard-col">
          <section className="card" aria-labelledby="attention-h">
            <h2 id="attention-h">Needs your attention</h2>
            {data.needsAttention.length === 0 ? (
              <p className="muted">Nothing needs your attention right now.</p>
            ) : (
              <ul className="plain-list">
                {data.needsAttention.map((t) => <TicketRow key={t.id} ticket={t} onOpen={onOpenTicket} />)}
              </ul>
            )}
          </section>
          <section className="card" aria-labelledby="req-recent-h">
            <h2 id="req-recent-h">Recently updated</h2>
            {data.recentlyUpdated.length === 0 ? (
              <p className="muted">No updates in the last 7 days.</p>
            ) : (
              <ul className="plain-list">
                {data.recentlyUpdated.map((t) => <TicketRow key={t.id} ticket={t} onOpen={onOpenTicket} />)}
              </ul>
            )}
          </section>
        </div>
        <div className="dashboard-col">
          <section className="card" aria-labelledby="req-quick-h">
            <h2 id="req-quick-h">Quick actions</h2>
            <div className="quick-actions">
              <Button variant="primary" onClick={onCreate}>+ Create Ticket</Button>
              <Button variant="secondary" onClick={() => onDrillDown({})}>View My Tickets</Button>
            </div>
          </section>
          <section className="card" aria-labelledby="req-resolved-h">
            <h2 id="req-resolved-h">Recently resolved</h2>
            {data.recentlyResolved.length === 0 ? (
              <p className="muted">Nothing resolved in the last 7 days.</p>
            ) : (
              <ul className="plain-list">
                {data.recentlyResolved.map((t) => <TicketRow key={t.id} ticket={t} onOpen={onOpenTicket} />)}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
