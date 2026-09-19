import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useRequester } from "../context/RequesterContext";
import { Button } from "./ui/Button";

type RefData = { id: number; name: string };
const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

// Implements Create Ticket per ui-spec.md §9 and api-spec.md POST /api/tickets.
export function CreateTicket({ onCreated }: { onCreated: (ticketNumber: string, ticketId: number) => void }) {
  const { requesterId, requesterName } = useRequester();
  const [refStatus, setRefStatus] = useState<"loading" | "ready" | "error">("loading");
  const [categories, setCategories] = useState<RefData[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RefData[]>([]);

  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [relatedSystemId, setRelatedSystemId] = useState<number | null>(null);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [requestedPriority, setRequestedPriority] = useState("MEDIUM");
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ ticketNumber: string; ticketId: number } | null>(null);

  useEffect(() => {
    Promise.all([api.getCategories(), api.getRelatedSystems()])
      .then(([cat, sys]) => {
        setCategories(cat.data);
        setRelatedSystems(sys.data);
        if (cat.data[0]) setCategoryId(cat.data[0].id);
        if (sys.data[0]) setRelatedSystemId(sys.data[0].id);
        setRefStatus("ready");
      })
      .catch(() => setRefStatus("error"));
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const errors: string[] = [];
    const accepted: File[] = [];

    for (const f of selected) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        errors.push(`${f.name}: unsupported file type`);
        continue;
      }
      if (f.size > MAX_SIZE) {
        errors.push(`${f.name}: exceeds 5 MB limit`);
        continue;
      }
      accepted.push(f);
    }

    const combined = [...files, ...accepted];
    if (combined.length > MAX_FILES) {
      errors.push(`Only ${MAX_FILES} attachments allowed; extra files were not added`);
    }
    setFiles(combined.slice(0, MAX_FILES));
    setFileErrors(errors);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // BR-11: prevent duplicate submission
    setApiError(null);

    const errors: Record<string, string> = {};
    const trimmedSummary = summary.trim();
    const trimmedDescription = description.trim();
    if (trimmedSummary.length < 5 || trimmedSummary.length > 120) {
      errors.summary = "Summary must be 5-120 characters";
    }
    if (trimmedDescription.length < 10 || trimmedDescription.length > 2000) {
      errors.description = "Description must be 10-2000 characters";
    }
    if (!categoryId) errors.categoryId = "Category is required";
    if (!relatedSystemId) errors.relatedSystemId = "Related System is required";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await api.createTicket({
        requesterId,
        categoryId,
        relatedSystemId,
        summary: trimmedSummary,
        description: trimmedDescription,
        requestedPriority,
      });
      const ticket = res.data;

      // BR-12: ticket exists even if some attachment uploads fail; report failures, don't block success.
      const failedUploads: string[] = [];
      for (const file of files) {
        try {
          await api.uploadAttachment(ticket.id, requesterId!, file);
        } catch {
          failedUploads.push(file.name);
        }
      }

      setSuccess({ ticketNumber: ticket.ticketNumber, ticketId: ticket.id });
      onCreated(ticket.ticketNumber, ticket.id);
      if (failedUploads.length > 0) {
        setApiError(`Ticket created, but these attachments failed to upload: ${failedUploads.join(", ")}. You can retry from Ticket Detail.`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFieldErrors(err.fields);
      } else {
        setApiError("Something went wrong submitting your ticket. Your entries were kept — please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (refStatus === "loading") return <p role="status">Loading form…</p>;
  if (refStatus === "error") {
    return <div className="callout callout-error" role="alert">Unable to load ticket reference data. Please try again shortly.</div>;
  }

  if (success) {
    return (
      <div className="card">
        <div className="callout" style={{ background: "var(--color-pale)" }}>
          Ticket <strong>{success.ticketNumber}</strong> was created successfully.
        </div>
        {apiError && <div className="callout callout-error" style={{ marginTop: 12 }}>{apiError}</div>}
      </div>
    );
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h1>Create Ticket</h1>

      <div className="field" data-readonly="true">
        <label htmlFor="requester">Requester</label>
        <input id="requester" value={requesterName ?? ""} readOnly />
      </div>

      {apiError && <div className="callout callout-error" role="alert">{apiError}</div>}

      <div className="field" data-invalid={!!fieldErrors.categoryId}>
        <label htmlFor="category">Category<span className="required">*</span></label>
        <select id="category" value={categoryId ?? ""} onChange={(e) => setCategoryId(Number(e.target.value))}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {fieldErrors.categoryId && <span className="field-error">{fieldErrors.categoryId}</span>}
      </div>

      <div className="field" data-invalid={!!fieldErrors.relatedSystemId}>
        <label htmlFor="relatedSystem">Related System<span className="required">*</span></label>
        <select id="relatedSystem" value={relatedSystemId ?? ""} onChange={(e) => setRelatedSystemId(Number(e.target.value))}>
          {relatedSystems.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="requestedPriority">Requested Priority<span className="required">*</span></label>
        <select id="requestedPriority" value={requestedPriority} onChange={(e) => setRequestedPriority(e.target.value)}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </div>

      <div className="field" data-invalid={!!fieldErrors.summary}>
        <label htmlFor="summary">Ticket Summary<span className="required">*</span></label>
        <input id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={120} />
        {fieldErrors.summary && <span className="field-error">{fieldErrors.summary}</span>}
      </div>

      <div className="field" data-invalid={!!fieldErrors.description}>
        <label htmlFor="description">Description<span className="required">*</span></label>
        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        {fieldErrors.description && <span className="field-error">{fieldErrors.description}</span>}
      </div>

      <div className="field">
        <label htmlFor="attachments">Attachments (up to 5, JPG/PNG/WEBP/PDF, 5MB max each)</label>
        <input id="attachments" type="file" multiple onChange={handleFileSelect} accept=".jpg,.jpeg,.png,.webp,.pdf" />
        <ul>
          {files.map((f) => (
            <li key={f.name}>{f.name} ({Math.round(f.size / 1024)} KB)</li>
          ))}
        </ul>
        {fileErrors.map((err) => (
          <span key={err} className="field-error" style={{ display: "block" }}>{err}</span>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
        <Button type="submit" variant="primary" busy={submitting}>
          Submit Ticket
        </Button>
      </div>
    </form>
  );
}