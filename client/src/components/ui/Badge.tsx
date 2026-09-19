type BadgeProps = { label: string; variant: "low" | "medium" | "high" | "status" };

// ui-spec.md §5: badges always pair color with a readable text label.
export function Badge({ label, variant }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{label}</span>;
}

export function priorityVariant(priority: string | null | undefined): BadgeProps["variant"] {
  if (priority === "LOW") return "low";
  if (priority === "HIGH") return "high";
  return "medium";
}
