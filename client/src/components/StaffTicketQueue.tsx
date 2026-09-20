import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Badge, priorityVariant } from "./ui/Badge";
import { Button } from "./ui/Button";

type Ticket = {
  id: number;
  ticketNumber: string;
  summary: string;
  category: { name: string };
  requestedPriority: string;
  itPriority: string | null;
  currentStatus: string;
  ticketOwner: { id: number; name: string } | null;
  updatedAt: string;
};

type ListState = "loading" | "EMPTY" | "NO_RESULTS" | "OK" | "error";

// IT Staff Ticket Queue per ui-spec.md §6 and api-spec.md GET /api/staff/tickets.
export function StaffTicketQueue({ onOpen }: { onOpen: (id: number) => void }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [state, setState] = useState<ListState>("loading");
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, totalItems: 0 });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    // Guard against out-of-order responses: if the user types a search term
    // quickly, the unfiltered request fired on mount can resolve *after*
    // the filtered one and overwrite it with the wrong list. Only the
    // response from the most recently fired effect is applied.
    let cancelled = false;
    setState("loading");
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    if (status) params.set("status", status);

    api
      .listStaffTickets(params)
      .then((res) => {
        if (cancelled) return;
        setTickets(res.data);
        setMeta(res.meta);
        setState(res.state);
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [search, status, page]);

  function clearFilters() {
    setSearch("");
    setStatus("");
    setPage(1);
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1>Ticket Queue</h1>
          <p>Find and prioritize work across all Requesters.</p>
        </div>
        <Button variant="secondary" onClick={clearFilters}>Clear Filters</Button>
      </div>

      <div style={{ display: "flex", gap: 12, margin: "16px 0", flexWrap: "wrap" }}>
        <input
          placeholder="Search by ticket number or summary…"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          style={{ flex: 1, minWidth: 220, padding: 10, borderRadius: 8, border: "1px solid var(--color-border)" }}
        />
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">All Statuses</option>
          <option value="NEW">New</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="WAITING_FOR_REQUESTER">Waiting for Requester</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
          <option value="REOPENED">Reopened</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {state === "loading" && <p role="status">Loading queue…</p>}
      {state === "error" && <div className="callout callout-error" role="alert">Unable to load the ticket queue. Please try again.</div>}
      {state === "EMPTY" && <div className="callout">No tickets exist yet.</div>}
      {state === "NO_RESULTS" && (
        <div className="callout">
          No tickets match your filters. <Button variant="tertiary" onClick={clearFilters}>Clear Filters</Button>
        </div>
      )}

      {state === "OK" && (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>
                <th>Ticket No.</th><th>Summary</th><th>Category</th>
                <th>Req. Priority</th><th>IT Priority</th><th>Status</th><th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} onClick={() => onOpen(t.id)} style={{ cursor: "pointer", borderBottom: "1px solid #eee" }}>
                  <td>{t.ticketNumber}</td>
                  <td>{t.summary}</td>
                  <td>{t.category?.name}</td>
                  <td><Badge label={t.requestedPriority} variant={priorityVariant(t.requestedPriority)} /></td>
                  <td>{t.itPriority ? <Badge label={t.itPriority} variant={priorityVariant(t.itPriority)} /> : "—"}</td>
                  <td><Badge label={t.currentStatus} variant="status" /></td>
                  <td>{t.ticketOwner?.name ?? "Unassigned"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <span>Showing page {meta.page} of {meta.totalPages} ({meta.totalItems} tickets)</span>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
