// BR-07, BR-08: length + trimming rules for Summary and Description.
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
export const STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "PENDING", "RESOLVED"] as const;
export const SORTABLE_FIELDS = ["createdAt", "updatedAt", "requestedPriority", "ticketNumber"] as const;

export function validatePriority(input: unknown): string | null {
  if (!PRIORITIES.includes(input as any)) {
    return "Must be LOW, MEDIUM, or HIGH";
  }
  return null;
}
