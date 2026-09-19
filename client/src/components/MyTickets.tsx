import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useRequester } from "../context/RequesterContext";
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
  updatedAt: string;
};

type ListState = "loading" | "EMPTY" | "NO_RESULTS" | "OK" | "error";

// Implements My Tickets per ui-spec.md §10 and api-spec.md GET /api/tickets.
export function MyTickets({ onOpen, onCreate }: { onOpen: (id: number) => void; onCreate: () => void }) {
  const { requesterId } = useRequester();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [state, setState] = useState<ListState>("loading");
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, totalItems: 0 });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!requesterId) return;
    setState("loading");
    const params = new URLSearchParams({ requesterId: String(requesterId), page: String(page) });
    if (search) params.set("search", search);
    if (status) params.set("status", status);

    api
      .listTickets(params)
      .then((res) => {
        setTickets(res.data);
        setMeta(res.meta);
        setState(res.state);
      })
      .catch(() => setState("error"));
  }, [requesterId, search, status, page]);

  function clearFilters() {
    setSearch("");
    setStatus("");
    setPage(1);
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1>My Tickets</h1>
          <p>View and track all of your support requests.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Button variant="secondary" onClick={clearFilters}>Clear Filters</Button>
          <Button variant="primary" onClick={onCreate}>+ Create Ticket</Button>
        </div>
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
          <option value="PENDING">Pending</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>

      {state === "loading" && <p role="status">Loading tickets…</p>}
      {state === "error" && <div className="callout callout-error" role="alert">Unable to load your tickets. Please try again.</div>}
      {state === "EMPTY" && (
        <div className="callout">
          You haven't created any tickets yet. <Button variant="tertiary" onClick={onCreate}>Create your first ticket</Button>
        </div>
      )}
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
                <th>Requested Priority</th><th>Status</th><th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} onClick={() => onOpen(t.id)} style={{ cursor: "pointer", borderBottom: "1px solid #eee" }}>
                  <td>{t.ticketNumber}</td>
                  <td>{t.summary}</td>
                  <td>{t.category?.name}</td>
                  <td><Badge label={t.requestedPriority} variant={priorityVariant(t.requestedPriority)} /></td>
                  <td><Badge label={t.currentStatus} variant="status" /></td>
                  <td>{new Date(t.updatedAt).toLocaleString()}</td>
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
