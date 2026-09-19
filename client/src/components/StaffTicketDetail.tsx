import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { Badge, priorityVariant } from "./ui/Badge";
import { Button } from "./ui/Button";
import { STATUS_OPTIONS_FOR } from "../lib/statusTransitions";

type Note = { id: number; content: string; createdAt: string; author: { name: string } };
type Comment = { id: number; content: string; createdAt: string; author: { name: string; role: string } };

type TicketDetail = {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  category: { name: string };
  relatedSystem: { name: string };
  requester: { name: string; email: string };
  ticketOwner: { id: number; name: string } | null;
  requestedPriority: string;
  itPriority: string | null;
  currentStatus: string;
  appearsResolved: boolean;
  summary: string;
  description: string;
  attachments: any[];
  comments: Comment[];
  notes: Note[];
};

type Status = "loading" | "ready" | "not-found" | "error";

// IT Staff Ticket Detail per ui-spec.md §7: ownership, IT Priority, status
// workflow, Public Comments, and the Internal Notes panel visually separated
// from Public Comments (BR-04).
export function StaffTicketDetail({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const [status, setStatus] = useState<Status>("loading");
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    setStatus("loading");
    api
      .getStaffTicket(ticketId)
      .then((res) => {
        setTicket(res.data);
        setStatus("ready");
      })
      .catch((err) => {
        setStatus(err?.status === 404 ? "not-found" : "error");
      });
  }

  useEffect(load, [ticketId]);

  async function handleClaim() {
    setBusy(true);
    try {
      await api.claimTicket(ticketId);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handlePriorityChange(itPriority: string) {
    await api.setItPriority(ticketId, itPriority);
    load();
  }

  async function handleStatusChange(currentStatus: string) {
    setTransitionError(null);
    try {
      await api.setStatus(ticketId, currentStatus);
      load();
    } catch (err) {
      if (err instanceof ApiError) {
        setTransitionError(err.message2 ?? "That status change is not allowed from here.");
      }
    }
  }

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    if (commentDraft.trim().length === 0) return;
    await api.postComment(ticketId, commentDraft.trim());
    setCommentDraft("");
    load();
  }

  async function handlePostNote(e: React.FormEvent) {
    e.preventDefault();
    if (noteDraft.trim().length === 0) return;
    await api.postNote(ticketId, noteDraft.trim());
    setNoteDraft("");
    load();
  }

  if (status === "loading") return <p role="status">Loading ticket…</p>;
  if (status === "not-found") {
    return (
      <div className="callout callout-error" role="alert">
        Ticket not found.
        <button className="btn btn-tertiary" onClick={onBack}>← Back to Queue</button>
      </div>
    );
  }
  if (status === "error" || !ticket) {
    return <div className="callout callout-error" role="alert">Unable to load this ticket. Please try again.</div>;
  }

  return (
    <div>
      <button className="btn btn-tertiary" onClick={onBack}>← Back to Queue</button>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <ReadOnlyField label="Ticket No." value={ticket.ticketNumber} />
          <ReadOnlyField label="Requester" value={`${ticket.requester.name} (${ticket.requester.email})`} />
          <ReadOnlyField label="Category" value={ticket.category.name} />
          <ReadOnlyField label="Related System" value={ticket.relatedSystem.name} />

          <div className="field">
            <label>Ticket Owner</label>
            {ticket.ticketOwner ? (
              <input readOnly value={ticket.ticketOwner.name} />
            ) : (
              <Button variant="secondary" busy={busy} onClick={handleClaim}>Claim</Button>
            )}
          </div>

          <div className="field" data-readonly="true">
            <label>Requested Priority</label>
            <Badge label={ticket.requestedPriority} variant={priorityVariant(ticket.requestedPriority)} />
          </div>

          <div className="field">
            <label htmlFor="itPriority">IT Priority</label>
            <select
              id="itPriority"
              value={ticket.itPriority ?? ""}
              onChange={(e) => handlePriorityChange(e.target.value)}
            >
              <option value="" disabled>Select…</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="currentStatus">Current Status</label>
            <select
              id="currentStatus"
              value={ticket.currentStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value={ticket.currentStatus}>{ticket.currentStatus}</option>
              {STATUS_OPTIONS_FOR(ticket.currentStatus).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {ticket.appearsResolved && (
              <span style={{ fontSize: 12, color: "var(--color-success)" }}>Requester marked this as resolved</span>
            )}
          </div>
        </div>

        {transitionError && <div className="callout callout-error" style={{ marginTop: 12 }} role="alert">{transitionError}</div>}

        <div className="field" data-readonly="true">
          <label>Summary</label>
          <input readOnly value={ticket.summary} />
        </div>
        <div className="field" data-readonly="true">
          <label>Description</label>
          <textarea readOnly value={ticket.description} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Attachments</h2>
        <ul>
          {ticket.attachments.filter((a) => !a.isRemoved).map((a) => (
            <li key={a.id}>{a.fileName} ({Math.round(a.sizeBytes / 1024)} KB)</li>
          ))}
          {ticket.attachments.filter((a) => !a.isRemoved).length === 0 && <li>No attachments.</li>}
        </ul>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Public Comments</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {ticket.comments.map((c) => (
            <li key={c.id} style={{ marginBottom: 12, borderBottom: "1px solid #eee", paddingBottom: 8 }}>
              <strong>{c.author.name}</strong>{" "}
              <Badge label={c.author.role === "REQUESTER" ? "Requester" : "IT Support"} variant="status" />{" "}
              <span style={{ color: "#6B7A70", fontSize: 12 }}>{new Date(c.createdAt).toLocaleString()}</span>
              <p style={{ margin: "4px 0 0" }}>{c.content}</p>
            </li>
          ))}
          {ticket.comments.length === 0 && <li>No comments yet.</li>}
        </ul>
        <form onSubmit={handlePostComment} style={{ display: "flex", gap: 8 }}>
          <input placeholder="Type your comment here…" value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} style={{ flex: 1 }} />
          <Button type="submit" variant="primary">Post Comment</Button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16, background: "var(--color-pale)" }}>
        <h2>
          Internal Notes{" "}
          <span style={{ fontSize: 12, color: "var(--color-warning)", fontWeight: 400 }}>
            — not visible to Requester
          </span>
        </h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {ticket.notes.map((n) => (
            <li key={n.id} style={{ marginBottom: 12, borderBottom: "1px solid #dce6e0", paddingBottom: 8 }}>
              <strong>{n.author.name}</strong>{" "}
              <span style={{ color: "#6B7A70", fontSize: 12 }}>{new Date(n.createdAt).toLocaleString()}</span>
              <p style={{ margin: "4px 0 0" }}>{n.content}</p>
            </li>
          ))}
          {ticket.notes.length === 0 && <li>No internal notes yet.</li>}
        </ul>
        <form onSubmit={handlePostNote} style={{ display: "flex", gap: 8 }}>
          <input placeholder="Add an internal note…" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} style={{ flex: 1 }} />
          <Button type="submit" variant="secondary">Add Note</Button>
        </form>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="field" data-readonly="true">
      <label>{label}</label>
      <input readOnly value={value} />
    </div>
  );
}
