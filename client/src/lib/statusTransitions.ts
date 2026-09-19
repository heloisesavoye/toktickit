// Client-side mirror of server/src/lib/validators.ts STATUS_TRANSITIONS
// (specification.md §9). Convenience only — the server re-validates every
// transition regardless of what the client offers (FR-08).
const STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  CANCELLED: [],
};

export function STATUS_OPTIONS_FOR(current: string): string[] {
  return STATUS_TRANSITIONS[current] ?? [];
}
