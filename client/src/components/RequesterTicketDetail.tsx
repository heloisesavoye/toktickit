import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useRequester } from "../context/RequesterContext";
import { Badge, priorityVariant } from "./ui/Badge";
import { AttachmentSection } from "./AttachmentSection";

type TicketDetail = {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  category: { name: string };
  relatedSystem: { name: string };
  requester: { name: string };
  requestedPriority: string;
  itPriority: string | null;
  currentStatus: string;
  summary: string;
  description: string;
  attachments: any[];
};

type Status = "loading" | "ready" | "not-found" | "error";

// Requester Ticket Detail (View Mode) per ui-spec.md §11. Read-only ticket info +
// attachment actions only — no comments/notes/status changes (out of Lab 2 scope).
export function RequesterTicketDetail({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const { requesterId } = useRequester();
  const [status, setStatus] = useState<Status>("loading");
  const [ticket, setTicket] = useState<TicketDetail | null>(null);

  function load() {
    if (!requesterId) return;
    setStatus("loading");
    api
      .getTicket(ticketId, requesterId)
      .then((res) => {
        setTicket(res.data);
        setStatus("ready");
      })
      .catch((err) => {
        setStatus(err?.status === 404 ? "not-found" : "error");
      });
  }

  useEffect(load, [ticketId, requesterId]);

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
          <ReadOnlyField label="Requester" value={ticket.requester.name} />
          <div className="field">
            <label>Requested Priority</label>
            <Badge label={ticket.requestedPriority} variant={priorityVariant(ticket.requestedPriority)} />
          </div>
          <div className="field">
            <label>Current Status</label>
            <Badge label={ticket.currentStatus} variant="status" />
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
      </div>

      <AttachmentSection ticketId={ticket.id} attachments={ticket.attachments} onChanged={load} />
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
