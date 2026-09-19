import { useState } from "react";
import { api } from "../api/client";
import { useRequester } from "../context/RequesterContext";
import { Button } from "./ui/Button";

type Attachment = {
  id: number;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  isRemoved: boolean;
  removedAt: string | null;
  removalReason: string | null;
};

// Attachment lifecycle per ui-spec.md §11 and api-spec.md attachment endpoints.
// BR-15/16/17: soft removal only, requires a reason, owner-only.
export function AttachmentSection({
  ticketId,
  attachments,
  onChanged,
}: {
  ticketId: number;
  attachments: Attachment[];
  onChanged: () => void;
}) {
  const { requesterId } = useRequester();
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const active = attachments.filter((a) => !a.isRemoved);
  const removed = attachments.filter((a) => a.isRemoved);

  async function handleAddFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !requesterId) return;
    setUploading(true);
    setError(null);
    try {
      await api.uploadAttachment(ticketId, requesterId, file);
      onChanged();
    } catch {
      setError("Could not add this attachment. Check its type and size and try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function confirmRemove(id: number) {
    if (!requesterId) return;
    if (reason.trim().length < 5) {
      setError("Please provide a removal reason of at least 5 characters.");
      return;
    }
    try {
      await api.removeAttachment(id, requesterId, reason.trim());
      setRemovingId(null);
      setReason("");
      onChanged();
    } catch {
      setError("Could not remove this attachment. Please try again.");
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>Attachments</h2>
      {error && <div className="callout callout-error" role="alert">{error}</div>}

      <ul>
        {active.map((a) => (
          <li key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span>{a.fileName} ({Math.round(a.sizeBytes / 1024)} KB)</span>
            <a href={api.downloadUrl(a.id, requesterId!)} target="_blank" rel="noreferrer">Download</a>
            {removingId === a.id ? (
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  placeholder="Removal reason (min 5 chars)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <Button variant="destructive" onClick={() => confirmRemove(a.id)}>Confirm Remove</Button>
                <Button variant="tertiary" onClick={() => { setRemovingId(null); setReason(""); }}>Cancel</Button>
              </span>
            ) : (
              <Button variant="destructive" onClick={() => setRemovingId(a.id)}>Remove</Button>
            )}
          </li>
        ))}
      </ul>

      <div className="field" style={{ maxWidth: 320 }}>
        <label htmlFor="add-attachment">Add Attachment</label>
        <input id="add-attachment" type="file" onChange={handleAddFile} disabled={uploading || active.length >= 5} accept=".jpg,.jpeg,.png,.webp,.pdf" />
      </div>

      {removed.length > 0 && (
        <>
          <h3 style={{ marginTop: 24 }}>Removed Attachments</h3>
          <ul style={{ color: "#6B7A70" }}>
            {removed.map((a) => (
              <li key={a.id}>
                {a.fileName} — removed {a.removedAt ? new Date(a.removedAt).toLocaleDateString() : ""} ({a.removalReason})
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
