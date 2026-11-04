// Lab 4 domain rules for Actions Taken and the final Ticket workflow
// (docs/lab-04/specification.md §5, §9). Pure functions so they can be unit
// tested without a database (UNIT-01..UNIT-04).

export const ACTION_STATUSES = ["OPEN", "COMPLETED", "CANCELLED"] as const;
export type ActionStatusValue = (typeof ACTION_STATUSES)[number];

// BR-15
export const ACTIVE_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "REOPENED",
] as const;
export const FINAL_STATUSES = ["CLOSED", "CANCELLED"] as const;

export function isTicketFinal(status: string): boolean {
  return (FINAL_STATUSES as readonly string[]).includes(status);
}

// BR-09
export function isValidActionTransition(from: string, to: string): boolean {
  return from === "OPEN" && (to === "COMPLETED" || to === "CANCELLED");
}

// BR-07: allow a little clock skew between browser and server.
export const FUTURE_SKEW_MS = 5 * 60 * 1000;

export type ActionInput = {
  actionAt?: unknown;
  description?: unknown;
  result?: unknown;
  assigneeId?: unknown;
  followUpRequired?: unknown;
  followUpNote?: unknown;
  attachmentNotes?: unknown;
};

export type CleanActionInput = {
  actionAt?: Date;
  description?: string;
  result?: string;
  assigneeId?: number;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
};

function trimmed(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * BR-05..BR-07. `partial` = PATCH semantics (only validate supplied fields,
 * but the follow-up rule is evaluated against the merged record via
 * `existing`). Returns either field errors or the cleaned values.
 */
export function validateActionInput(
  input: ActionInput,
  opts: {
    partial: boolean;
    ticketCreatedAt: Date;
    now?: Date;
    existing?: { followUpRequired: boolean; followUpNote: string | null };
  }
): { fields: Record<string, string>; clean: CleanActionInput } {
  const fields: Record<string, string> = {};
  const clean: CleanActionInput = {};
  const now = opts.now ?? new Date();
  const has = (k: keyof ActionInput) => !opts.partial || input[k] !== undefined;

  if (has("description")) {
    const d = trimmed(input.description);
    if (d.length < 5 || d.length > 2000) fields.description = "Description must be 5-2000 characters";
    else clean.description = d;
  }

  if (has("result")) {
    const r = trimmed(input.result);
    if (r.length < 1 || r.length > 1000) fields.result = "Result is required (max 1000 characters)";
    else clean.result = r;
  }

  if (input.actionAt !== undefined && input.actionAt !== null && input.actionAt !== "") {
    const at = new Date(String(input.actionAt));
    if (Number.isNaN(at.getTime())) {
      fields.actionAt = "Enter a valid date and time";
    } else if (at.getTime() > now.getTime() + FUTURE_SKEW_MS) {
      fields.actionAt = "Action date/time cannot be in the future";
    } else if (at.getTime() < opts.ticketCreatedAt.getTime() - 60 * 1000) {
      fields.actionAt = "Action date/time cannot be before the ticket was created";
    } else {
      clean.actionAt = at;
    }
  } else if (!opts.partial) {
    clean.actionAt = now;
  }

  if (input.assigneeId !== undefined && input.assigneeId !== null && input.assigneeId !== "") {
    const id = Number(input.assigneeId);
    if (!Number.isInteger(id) || id <= 0) fields.assigneeId = "Choose a valid assignee";
    else clean.assigneeId = id;
  }

  if (input.attachmentNotes !== undefined) {
    const a = trimmed(input.attachmentNotes);
    if (a.length > 500) fields.attachmentNotes = "Attachment notes must be 500 characters or fewer";
    else clean.attachmentNotes = a.length ? a : null;
  }

  // BR-06: evaluated against the merged (existing + incoming) record.
  if (input.followUpRequired !== undefined && typeof input.followUpRequired !== "boolean") {
    fields.followUpRequired = "Choose yes or no";
  } else {
    const followUp =
      input.followUpRequired !== undefined
        ? (input.followUpRequired as boolean)
        : opts.existing?.followUpRequired ?? false;
    const noteRaw =
      input.followUpNote !== undefined ? trimmed(input.followUpNote) : opts.existing?.followUpNote ?? "";
    if (input.followUpRequired !== undefined) clean.followUpRequired = followUp;
    if (followUp) {
      if (noteRaw.length < 1) fields.followUpNote = "Follow-up note is required when follow-up is needed";
      else if (noteRaw.length > 1000) fields.followUpNote = "Follow-up note must be 1000 characters or fewer";
      else if (input.followUpNote !== undefined || input.followUpRequired !== undefined) clean.followUpNote = noteRaw;
    } else if (input.followUpRequired !== undefined || input.followUpNote !== undefined) {
      clean.followUpNote = null;
    }
  }

  return { fields, clean };
}

// BR-08
export type ResolutionGate = {
  allowed: boolean;
  completedActions: number;
  openActions: number;
  reason: string | null;
};

export function evaluateResolutionGate(actions: { status: string }[]): ResolutionGate {
  const completedActions = actions.filter((a) => a.status === "COMPLETED").length;
  const openActions = actions.filter((a) => a.status === "OPEN").length;
  let reason: string | null = null;
  if (completedActions === 0) {
    reason = "Record and complete at least one Action Taken before resolving.";
  } else if (openActions > 0) {
    reason = `Complete or cancel the ${openActions} open Action Taken${openActions > 1 ? "s" : ""} first.`;
  }
  return { allowed: reason === null, completedActions, openActions, reason };
}
