import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "tertiary" | "destructive";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  busy?: boolean;
  busyLabel?: string;
};

// ui-spec.md §4: consistent button hierarchy incl. a required busy state.
export function Button({ variant = "primary", busy, busyLabel = "Submitting…", children, disabled, ...rest }: Props) {
  return (
    <button className={`btn btn-${variant}`} disabled={disabled || busy} {...rest}>
      {busy ? busyLabel : children}
    </button>
  );
}
