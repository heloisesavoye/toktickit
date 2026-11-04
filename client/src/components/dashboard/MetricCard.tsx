import { statusLabel } from "../../lib/labels";

// Lab 4 dashboard metric card (ui-spec.md §2-3): the whole card is one
// button so mouse and keyboard users can drill down (AC-15, AC-26).
export function MetricCard({
  label,
  count,
  onOpen,
}: {
  label: string;
  count: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="metric-card"
      onClick={onOpen}
      aria-label={`${label}: ${count}, view list`}
    >
      <span className="metric-label">{label}</span>
      <span className="metric-value">{count}</span>
      <span className="metric-link">{count === 0 ? "Nothing here" : "View all →"}</span>
    </button>
  );
}

export function TicketRow({
  ticket,
  onOpen,
}: {
  ticket: { id: number; ticketNumber: string; summary: string; currentStatus: string; updatedAt: string };
  onOpen: (id: number) => void;
}) {
  return (
    <li>
      <button type="button" className="list-row" onClick={() => onOpen(ticket.id)}>
        <span className="list-row-main">
          <strong>{ticket.ticketNumber}</strong> <span>{ticket.summary}</span>
        </span>
        <span className="list-row-meta">
          <StatusBadge status={ticket.currentStatus} />
          <span className="muted">{new Date(ticket.updatedAt).toLocaleDateString()}</span>
        </span>
      </button>
    </li>
  );
}


export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-st-${status.toLowerCase()}`}>{statusLabel(status)}</span>;
}
