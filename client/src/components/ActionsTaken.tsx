import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/Button";
import { ACTION_STATUS_LABELS, formatDateTime, toLocalInputValue } from "../lib/labels";

export type Action = {
  id: number;
  ticketId: number;
  actionAt: string;
  description: string;
  result: string;
  performedBy: { id: number; name: string };
  assignee: { id: number; name: string; isActive?: boolean };
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  completedAt: string | null;
  cancelledAt: string | null;
  version: number;
};

type Assignee = { id: number; name: string; role: string };

type Draft = {
  actionAt: string;
  description: string;
  result: string;
  assigneeId: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
};

function emptyDraft(userId: number | undefined): Draft {
  return {
    actionAt: toLocalInputValue(new Date()),
    description: "",
    result: "",
    assigneeId: userId ? String(userId) : "",
    followUpRequired: false,
    followUpNote: "",
    attachmentNotes: "",
  };
}

function draftFrom(a: Action): Draft {
  return {
    actionAt: toLocalInputValue(new Date(a.actionAt)),
    description: a.description,
    result: a.result,
    assigneeId: String(a.assignee.id),
    followUpRequired: a.followUpRequired,
    followUpNote: a.followUpNote ?? "",
    attachmentNotes: a.attachmentNotes ?? "",
  };
}

// Client-side mirror of BR-05/BR-06 for instant feedback; the server
// re-validates everything (FR-08 from Lab 3).
function validate(d: Draft): Record<string, string> {
  const f: Record<string, string> = {};
  if (d.description.trim().length < 5) f.description = "Description must be at least 5 characters";
  if (d.description.trim().length > 2000) f.description = "Description must be 2000 characters or fewer";
  if (d.result.trim().length === 0) f.result = "Result is required";
  if (d.result.trim().length > 1000) f.result = "Result must be 1000 characters or fewer";
  if (d.followUpRequired && d.followUpNote.trim().length === 0)
    f.followUpNote = "Follow-up note is required when follow-up is needed";
  if (d.attachmentNotes.length > 500) f.attachmentNotes = "Attachment notes must be 500 characters or fewer";
  if (!d.actionAt) f.actionAt = "Enter the action date and time";
  return f;
}

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; action: Action };

// Lab 4 Actions Taken area on the IT Staff Ticket Detail (ui-spec.md §4).
export function ActionsTaken({
  ticketId,
  actions,
  ticketFinal,
  onChanged,
}: {
  ticketId: number;
  actions: Action[];
  ticketFinal: boolean;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(user?.id));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ kind: "error" | "warning" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const inFlight = useRef(false); // AC-23: blocks double submit before re-render

  useEffect(() => {
    api.listAssignees().then((res) => setAssignees(res.data)).catch(() => setAssignees([]));
  }, []);

  function openCreate() {
    setDraft(emptyDraft(user?.id));
    setFields({});
    setBanner(null);
    setMode({ kind: "create" });
  }

  function openEdit(a: Action) {
    setDraft(draftFrom(a));
    setFields({});
    setBanner(null);
    setConfirmCancel(false);
    setMode({ kind: "edit", action: a });
  }

  function close() {
    setMode({ kind: "list" });
    setFields({});
    setConfirmCancel(false);
  }

  function handleError(err: unknown) {
    if (err instanceof ApiError) {
      if (err.code === "VALIDATION_ERROR" || err.code === "INVALID_ASSIGNEE") {
        setFields(err.fields ?? {});
        setBanner({ kind: "error", text: "Please fix the highlighted fields." });
        return;
      }
      if (err.code === "STALE_UPDATE") {
        setBanner({
          kind: "warning",
          text: "Someone else changed this action. Your text is kept below — reload to see their version.",
        });
        return;
      }
      if (err.code === "ACTION_NOT_EDITABLE" || err.code === "TICKET_NOT_ACTIVE") {
        setBanner({ kind: "error", text: err.message2 ?? "This action can no longer be changed." });
        return;
      }
    }
    // AC-24: safe failure, entered values kept.
    setBanner({ kind: "error", text: "Couldn't save. Your entries are kept — try again." });
  }

  async function run(fn: () => Promise<unknown>, successText: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    try {
      await fn();
      setBanner({ kind: "success", text: successText });
      close();
      onChanged();
    } catch (err) {
      handleError(err);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  function payload() {
    return {
      actionAt: new Date(draft.actionAt).toISOString(),
      description: draft.description,
      result: draft.result,
      assigneeId: draft.assigneeId ? Number(draft.assigneeId) : undefined,
      followUpRequired: draft.followUpRequired,
      followUpNote: draft.followUpRequired ? draft.followUpNote : "",
      attachmentNotes: draft.attachmentNotes,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(draft);
    setFields(errs);
    if (Object.keys(errs).length > 0) {
      setBanner({ kind: "error", text: "Please fix the highlighted fields." });
      const first = document.getElementById(`action-${Object.keys(errs)[0]}`);
      first?.focus();
      return;
    }
    if (mode.kind === "create") {
      await run(() => api.createAction(ticketId, payload()), "Action saved.");
    } else if (mode.kind === "edit") {
      await run(() => api.updateAction(mode.action.id, { ...payload(), version: mode.action.version }), "Action updated.");
    }
  }

  const readOnly = mode.kind === "edit" && mode.action.status !== "OPEN";
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const err = (k: string) =>
    fields[k] ? (
      <span id={`action-${k}-error`} className="field-error">{fields[k]}</span>
    ) : null;
  const fieldProps = (k: string) => ({
    id: `action-${k}`,
    "aria-invalid": fields[k] ? true : undefined,
    "aria-describedby": fields[k] ? `action-${k}-error` : undefined,
  });

  return (
    <section className="card" style={{ marginTop: 16 }} aria-labelledby="actions-h">
      <div className="section-header">
        <h2 id="actions-h">Actions Taken</h2>
        {mode.kind === "list" && (
          <span title={ticketFinal ? "Reopen this ticket to record new actions." : undefined}>
            <Button variant="primary" onClick={openCreate} disabled={ticketFinal}>+ Add action</Button>
          </span>
        )}
      </div>
      {ticketFinal && mode.kind === "list" && (
        <p className="muted">This ticket is closed or cancelled. Reopen it to record new actions.</p>
      )}

      {banner && (
        <div
          className={`callout ${banner.kind === "error" ? "callout-error" : banner.kind === "warning" ? "callout-warning" : ""}`}
          role={banner.kind === "success" ? "status" : "alert"}
          style={{ marginBottom: 12 }}
        >
          {banner.text}
          {banner.kind === "warning" && (
            <Button variant="tertiary" onClick={() => { close(); setBanner(null); onChanged(); }}>Reload</Button>
          )}
        </div>
      )}

      {mode.kind === "list" && (
        actions.length === 0 ? (
          <p className="muted">No actions recorded yet. Add the first action to start tracking work.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table stack-on-mobile">
              <thead>
                <tr>
                  <th>Date/Time</th><th>Description</th><th>Result</th><th>Performed by</th>
                  <th>Assignee</th><th>Follow-up</th><th>Status</th><th><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Date/Time">{formatDateTime(a.actionAt)}</td>
                    <td data-label="Description" className="truncate">{a.description}</td>
                    <td data-label="Result" className="truncate">{a.result}</td>
                    <td data-label="Performed by">{a.performedBy.name}</td>
                    <td data-label="Assignee">{a.assignee.name}</td>
                    <td data-label="Follow-up">{a.followUpRequired ? "Yes" : "No"}</td>
                    <td data-label="Status"><span className={`badge badge-act-${a.status.toLowerCase()}`}>{ACTION_STATUS_LABELS[a.status]}</span></td>
                    <td>
                      <Button variant="tertiary" onClick={() => openEdit(a)} aria-label={`View or edit action from ${formatDateTime(a.actionAt)}`}>
                        {a.status === "OPEN" ? "View / Edit" : "View"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {mode.kind !== "list" && (
        <form onSubmit={handleSubmit} noValidate aria-label={mode.kind === "create" ? "Add action" : "Edit action"}>
          <h3>{mode.kind === "create" ? "New action" : readOnly ? `Action (${ACTION_STATUS_LABELS[mode.action.status]})` : "Edit action"}</h3>
          <div className="responsive-grid form-grid-2">
            <div className="field" data-readonly={readOnly || undefined} data-invalid={fields.actionAt ? "true" : undefined}>
              <label htmlFor="action-actionAt">Action Date/Time<span className="required">*</span></label>
              <input type="datetime-local" {...fieldProps("actionAt")} value={draft.actionAt} readOnly={readOnly} onChange={(e) => set({ actionAt: e.target.value })} />
              {err("actionAt")}
            </div>
            <div className="field" data-readonly="true">
              <label htmlFor="action-performedBy">Performed by</label>
              <input id="action-performedBy" readOnly value={mode.kind === "edit" ? mode.action.performedBy.name : user?.name ?? ""} />
            </div>
          </div>

          <div className="field" data-readonly={readOnly || undefined} data-invalid={fields.description ? "true" : undefined}>
            <label htmlFor="action-description">Action Description<span className="required">*</span></label>
            <textarea {...fieldProps("description")} value={draft.description} readOnly={readOnly} onChange={(e) => set({ description: e.target.value })} />
            {err("description")}
          </div>

          <div className="field" data-readonly={readOnly || undefined} data-invalid={fields.result ? "true" : undefined}>
            <label htmlFor="action-result">Result<span className="required">*</span></label>
            <textarea {...fieldProps("result")} value={draft.result} readOnly={readOnly} onChange={(e) => set({ result: e.target.value })} style={{ minHeight: 80 }} />
            {err("result")}
          </div>

          <div className="responsive-grid form-grid-2">
            <div className="field" data-readonly={readOnly || undefined} data-invalid={fields.assigneeId ? "true" : undefined}>
              <label htmlFor="action-assigneeId">Assignee</label>
              <select {...fieldProps("assigneeId")} value={draft.assigneeId} disabled={readOnly} onChange={(e) => set({ assigneeId: e.target.value })}>
                {mode.kind === "edit" && !assignees.some((u) => String(u.id) === draft.assigneeId) && (
                  <option value={draft.assigneeId}>{mode.action.assignee.name} (inactive)</option>
                )}
                {assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {err("assigneeId")}
            </div>
            <fieldset className="field" disabled={readOnly} style={{ border: "none", padding: 0, margin: "0 0 16px" }}>
              <legend style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Follow-Up Required?</legend>
              <div style={{ display: "flex", gap: 16, minHeight: 44, alignItems: "center" }}>
                <label><input type="radio" name="followUp" checked={draft.followUpRequired} onChange={() => set({ followUpRequired: true })} /> Yes</label>
                <label><input type="radio" name="followUp" checked={!draft.followUpRequired} onChange={() => set({ followUpRequired: false })} /> No</label>
              </div>
            </fieldset>
          </div>

          {draft.followUpRequired && (
            <div className="field" data-readonly={readOnly || undefined} data-invalid={fields.followUpNote ? "true" : undefined}>
              <label htmlFor="action-followUpNote">Follow-up Note<span className="required">*</span></label>
              <input {...fieldProps("followUpNote")} value={draft.followUpNote} readOnly={readOnly} onChange={(e) => set({ followUpNote: e.target.value })} />
              {err("followUpNote")}
            </div>
          )}

          <div className="field" data-readonly={readOnly || undefined} data-invalid={fields.attachmentNotes ? "true" : undefined}>
            <label htmlFor="action-attachmentNotes">Attachment Notes</label>
            <input {...fieldProps("attachmentNotes")} value={draft.attachmentNotes} readOnly={readOnly} placeholder="Which file to look at, e.g. screenshot.png" onChange={(e) => set({ attachmentNotes: e.target.value })} />
            {err("attachmentNotes")}
          </div>

          {mode.kind === "edit" && mode.action.completedAt && <p className="muted">Completed {formatDateTime(mode.action.completedAt)}</p>}
          {mode.kind === "edit" && mode.action.cancelledAt && <p className="muted">Cancelled {formatDateTime(mode.action.cancelledAt)}</p>}

          <div className="form-actions">
            {!readOnly && (
              <Button type="submit" variant="primary" busy={saving} busyLabel="Saving…">
                {mode.kind === "create" ? "Save action" : "Save changes"}
              </Button>
            )}
            {mode.kind === "edit" && !readOnly && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => run(() => api.completeAction(mode.action.id, mode.action.version), "Action marked completed.")}
                >
                  Mark completed
                </Button>
                <Button type="button" variant="destructive" disabled={saving} onClick={() => setConfirmCancel(true)}>
                  Cancel action
                </Button>
              </>
            )}
            <Button type="button" variant="tertiary" onClick={close}>{readOnly ? "Back" : "Close"}</Button>
          </div>
        </form>
      )}

      {confirmCancel && mode.kind === "edit" && (
        <ConfirmDialog
          title="Cancel this action?"
          body="A cancelled action stays in the history but can no longer be edited."
          confirmLabel="Cancel action"
          onConfirm={() => run(() => api.cancelAction(mode.action.id, mode.action.version), "Action cancelled.")}
          onClose={() => setConfirmCancel(false)}
        />
      )}
    </section>
  );
}

// Accessible confirmation dialog: focus moves in, Tab is trapped, Escape
// closes, focus returns to the opener (ui-spec.md §9).
function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("button");
    first?.focus();
    return () => opener?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    if (e.key === "Tab" && ref.current) {
      const buttons = Array.from(ref.current.querySelectorAll<HTMLElement>("button"));
      const i = buttons.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i === 0) { e.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (!e.shiftKey && i === buttons.length - 1) { e.preventDefault(); buttons[0].focus(); }
    }
  }

  return (
    <div className="dialog-backdrop">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="dlg-title" className="dialog card" onKeyDown={onKeyDown}>
        <h2 id="dlg-title">{title}</h2>
        <p>{body}</p>
        <div className="form-actions">
          <Button variant="tertiary" onClick={onClose}>Keep action</Button>
          <Button variant="destructive" onClick={() => { onClose(); onConfirm(); }}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
