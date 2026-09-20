// BR-07, BR-08 (Lab 2 numbering): length + trimming rules for Summary and Description.
export function validateSummary(input: unknown): string | null {
  const trimmed = typeof input === "string" ? input.trim() : "";
  if (trimmed.length < 5 || trimmed.length > 120) {
    return "Summary must be 5-120 characters";
  }
  return null;
}

export function validateDescription(input: unknown): string | null {
  const trimmed = typeof input === "string" ? input.trim() : "";
  if (trimmed.length < 10 || trimmed.length > 2000) {
    return "Description must be 10-2000 characters";
  }
  return null;
}

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

// Lab 3: full status set (specification.md §9).
export const STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const;

export const SORTABLE_FIELDS = ["createdAt", "updatedAt", "requestedPriority", "ticketNumber"] as const;
export const STAFF_SORTABLE_FIELDS = [
  "createdAt",
  "updatedAt",
  "requestedPriority",
  "itPriority",
] as const;

export function validatePriority(input: unknown): string | null {
  if (!PRIORITIES.includes(input as any)) {
    return "Must be LOW, MEDIUM, or HIGH";
  }
  return null;
}

// Lab 3: BR-16 status transition matrix (specification.md §9). A Requester
// never reaches this table directly (FR-16/BR-17 restrict callers to IT
// Staff/Administrator at the route level).
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  CANCELLED: [],
};

export function isValidTransition(from: string, to: string): boolean {
  return (STATUS_TRANSITIONS[from] ?? []).includes(to);
}

// BR-11: simple, sufficient email shape check (uniqueness is enforced by the DB).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateEmail(input: unknown): string | null {
  if (typeof input !== "string" || !EMAIL_RE.test(input.trim())) {
    return "Enter a valid email address";
  }
  return null;
}

export function validateName(input: unknown): string | null {
  const trimmed = typeof input === "string" ? input.trim() : "";
  if (trimmed.length < 2 || trimmed.length > 120) {
    return "Name must be 2-120 characters";
  }
  return null;
}

export const ROLES = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const;
export function validateRole(input: unknown): string | null {
  if (!ROLES.includes(input as any)) {
    return "Must be REQUESTER, IT_STAFF, or ADMINISTRATOR";
  }
  return null;
}

// BR-19: Public Comment / Internal Note content rules.
export function validateCommentContent(input: unknown): string | null {
  const trimmed = typeof input === "string" ? input.trim() : "";
  if (trimmed.length === 0) return "Content is required";
  if (trimmed.length > 2000) return "Content must be 2000 characters or fewer";
  return null;
}
