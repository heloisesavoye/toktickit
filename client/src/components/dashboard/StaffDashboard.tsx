import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/Button";
import { MetricCard, TicketRow } from "./MetricCard";
import { formatDateTime, statusLabel, type ListFilter } from "../../lib/labels";

type Summary = { id: number; ticketNumber: string; summary: string; currentStatus: string; updatedAt: string };
type Metric = { count: number; filter: ListFilter };
type StaffDashboardData = {
  metrics: Record<"unassigned" | "new" | "inProgress" | "waitingForRequester" | "myAssigned", Metric>;
  byStatus: Record<string, number>;
  byItPriority: Record<string, number>;
  myOpenActions: {
    count: number;
    items: { id: number; ticketId: number; ticketNumber: string; description: string; actionAt: string; followUpRequired: boolean }[];
  };
  urgent: Summary[];
  recentlyUpdated: Summary[];
  userCounts?: Record<string, number>;
};

const CARDS: { key: keyof StaffDashboardData["metrics"]; label: string }[] = [
  { key: "unassigned", label: "Unassigned" },
  { key: "new", label: "New" },
  { key: "inProgress", label: "In Progress" },
  { key: "waitingForRequester", label: "Waiting for Requester" },
  { key: "myAssigned", label: "My Assigned" },
];

// Lab 4 IT Staff / Administrator dashboard (ui-spec.md §3, FR-16, FR-17).
export function StaffDashboard({
  onDrillDown,
  onOpenTicket,
  onOpenUsers,
}: {
  onDrillDown: (filter: ListFilter) => void;
  onOpenTicket: (id: number) => void;
  onOpenUsers?: () => void;
}) {
  const { user } = useAuth();
  const [state, setState] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [data, setData] = useState<StaffDashboardData | null>(null);

  function load() {
    setState("loading");
    api
      .getStaffDashboard()
      .then((res) => {
        setData(res.data);
        setState("ready");
      })
      .catch((err) => setState(err?.status === 403 ? "forbidden" : "error"));
  }
  useEffect(load, []);

  if (state === "loading") return <p role="status">Loading dashboard…</p>;
  if (state === "forbidden") {
    return <div className="callout callout-error" role="alert">You don't have access to this page.</div>;
  }
  if (state === "error" || !data) {
    return (
      <div className="callout callout-error" role="alert">
        Couldn't load the dashboard. <Button variant="tertiary" onClick={load}>Try again</Button>
      </div>
    );
  }

  const maxStatus = Math.max(1, ...Object.values(data.byStatus));

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Welcome back, {user?.name?.split(" ")[0]}!</h1>
          <p>Here's what's happening with your queue today.</p>
        </div>
        <Button variant="secondary" onClick={load}>Refresh</Button>
      </div>

      <div className="metric-grid metric-grid-5">
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
          <section className="card" aria-labelledby="my-actions-h">
            <h2 id="my-actions-h">My open Actions Taken ({data.myOpenActions.count})</h2>
            {data.myOpenActions.items.length === 0 ? (
              <p className="muted">No open actions assigned to you.</p>
            ) : (
              <ul className="plain-list">
                {data.myOpenActions.items.map((a) => (
                  <li key={a.id}>
                    <button type="button" className="list-row" onClick={() => onOpenTicket(a.ticketId)}>
                      <span className="list-row-main">
                        <strong>{a.ticketNumber}</strong> <span>{a.description}</span>
                      </span>
                      <span className="list-row-meta">
                        {a.followUpRequired && <span className="badge badge-medium">Follow-up</span>}
                        <span className="muted">{formatDateTime(a.actionAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="recent-h">
            <h2 id="recent-h">Recently updated</h2>
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
          <section className="card" aria-labelledby="urgent-h">
            <h2 id="urgent-h">Urgent tickets</h2>
            {data.urgent.length === 0 ? (
              <p className="muted">No active high-priority tickets.</p>
            ) : (
              <ul className="plain-list">
                {data.urgent.map((t) => <TicketRow key={t.id} ticket={t} onOpen={onOpenTicket} />)}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="bystatus-h">
            <h2 id="bystatus-h">Tickets by status</h2>
            <ul className="plain-list">
              {Object.entries(data.byStatus).map(([status, count]) => (
                <li key={status}>
                  <button type="button" className="bar-row" onClick={() => onDrillDown({ status })}>
                    <span className="bar-label">{statusLabel(status)}</span>
                    <span className="bar-track" aria-hidden="true">
                      <span className="bar-fill" style={{ width: `${(count / maxStatus) * 100}%` }} />
                    </span>
                    <span className="bar-count">{count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {data.userCounts && (
            <section className="card" aria-labelledby="users-h">
              <h2 id="users-h">Active users</h2>
              <ul className="plain-list">
                <li>Requesters: <strong>{data.userCounts.REQUESTER}</strong></li>
                <li>IT Staff: <strong>{data.userCounts.IT_STAFF}</strong></li>
                <li>Administrators: <strong>{data.userCounts.ADMINISTRATOR}</strong></li>
              </ul>
              {onOpenUsers && <Button variant="secondary" onClick={onOpenUsers}>Manage users</Button>}
            </section>
          )}

          <section className="card" aria-labelledby="quick-h">
            <h2 id="quick-h">Quick actions</h2>
            <div className="quick-actions">
              <Button variant="primary" onClick={() => onDrillDown({})}>Ticket Queue</Button>
              <Button variant="secondary" onClick={() => onDrillDown(data.metrics.unassigned.filter)}>Unassigned</Button>
              <Button variant="secondary" onClick={() => onDrillDown(data.metrics.myAssigned.filter)}>My Queue</Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
