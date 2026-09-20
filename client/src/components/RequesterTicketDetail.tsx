import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Badge, priorityVariant } from "./ui/Badge";
import { Button } from "./ui/Button";
import { AttachmentSection } from "./AttachmentSection";

type Comment = { id: number; content: string; createdAt: string; author: { name: string; role: string } };

type TicketDetail = {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  category: { name: string };
  relatedSystem: { name: string };
  requestedPriority: string;
  itPriority: string | null;
  currentStatus: string;
  appearsResolved: boolean;
  summary: string;
  description: string;
  attachments: any[];
  comments: Comment[];
};

type Status = "loading" | "ready" | "not-found" | "error";

// Requester Ticket Detail per ui-spec.md §5: Lab 2 read-only info + attachments,
// plus Lab 3's Public Comments panel and "Mark problem as resolved" action.
// No Internal Notes panel is ever rendered here (BR-04, AC-13).
export function RequesterTicketDetail({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const [status, setStatus] = useState<Status>("loading");
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [confirmingResolved, setConfirmingResolved] = useState(false);

  function load() {
    setStatus("loading");
    api
      .getTicket(ticketId)
      .then((res) => {
        setTicket(res.data);
        setStatus("ready");
      })
      .catch((err) => {
        setStatus(err?.status === 404 ? "not-found" : "error");
      });
  }

  useEffect(load, [ticketId]);

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    if (commentDraft.trim().length === 0) return;
    setPostingComment(true);
    try {
      await api.postComment(ticketId, commentDraft.trim());
      setCommentDraft("");
      load();
    } finally {
      setPostingComment(false);
    }
  }

  async function handleMarkResolved() {
    await api.markAppearsResolved(ticketId);
    setConfirmingResolved(false);
    load();
  }

  if (status === "loading") return <p role="status">Loading ticket…</p>;
  if (status === "not-found") {
    return (
      <div className="callout callout-error" role="alert">
        Ticket not found.
        <button className="btn btn-tertiary" onClick={onBack}>← Back to My Tickets</button>
      </div>
    );
  }
  if (status === "error" || !ticket) {
    return <div className="callout callout-error" role="alert">Unable to load this ticket. Please try again.</div>;
  }

  return (
    <div>
      <button className="btn btn-tertiary" onClick={onBack}>← Back to My Tickets</button>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <ReadOnlyField label="Ticket No." value={ticket.ticketNumber} />
          <ReadOnlyField label="Ticket Date" value={new Date(ticket.ticketDate).toLocaleString()} />
          <ReadOnlyField label="Category" value={ticket.category.name} />
          <ReadOnlyField label="Related System" value={ticket.relatedSystem.name} />
          <div className="field">
            <label>Requested Priority</label>
            <Badge label={ticket.requestedPriority} variant={priorityVariant(ticket.requestedPriority)} />
          </div>
          <div className="field">
            <label>Current Status</label>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge label={ticket.currentStatus} variant="status" />
              {ticket.appearsResolved && <span style={{ fontSize: 12, color: "var(--color-success)" }}>You marked this as resolved</span>}
            </span>
          </div>
        </div>

        <div className="field" data-readonly="true">
          <label>Summary</label>
          <input readOnly value={ticket.summary} />
        </div>
        <div className="field" data-readonly="true">
          <label>Description</label>
          <textarea readOnly value={ticket.description} />
        </div>

        {!ticket.appearsResolved && (
          <div style={{ marginTop: 12 }}>
            {confirmingResolved ? (
              <div className="callout">
                This lets IT Staff know your issue appears fixed; they'll still confirm and close the ticket.
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <Button variant="primary" onClick={handleMarkResolved}>Confirm</Button>
                  <Button variant="tertiary" onClick={() => setConfirmingResolved(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setConfirmingResolved(true)}>
                Mark problem as resolved
              </Button>
            )}
          </div>
        )}
      </div>

      <AttachmentSection ticketId={ticket.id} attachments={ticket.attachments} onChanged={load} />

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
          <input
            placeholder="Type your comment here…"
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button type="submit" variant="primary" busy={postingComment}>Post Comment</Button>
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
