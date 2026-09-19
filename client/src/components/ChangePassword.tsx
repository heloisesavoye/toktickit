import { useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/Button";

const RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "An uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "A lowercase letter", test: (v) => /[a-z]/.test(v) },
  { label: "A number", test: (v) => /[0-9]/.test(v) },
  { label: "A special character", test: (v) => /[^a-zA-Z0-9]/.test(v) },
];

// ui-spec.md §3: mandatory first-login password change (FR-03, FR-04, BR-02, BR-08).
export function ChangePassword() {
  const { refresh, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rulesPass = RULES.every((r) => r.test(newPassword));
  const matches = newPassword.length > 0 && newPassword === confirm;
  const canSubmit = rulesPass && matches && currentPassword.length > 0 && !busy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await api.changePassword(currentPassword, newPassword);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Current password is incorrect.");
      } else {
        setError("Unable to change your password right now. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 460, margin: "64px auto" }}>
      <h1>Change Your Password</h1>
      <p>You must change your password to continue.</p>

      {error && (
        <div className="callout callout-error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="currentPassword">Current (temporary) password</label>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="newPassword">New password</label>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="confirmPassword">Confirm new password</label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        <ul aria-label="Password requirements" style={{ listStyle: "none", padding: 0 }}>
          {RULES.map((r) => {
            const pass = r.test(newPassword);
            return (
              <li key={r.label} style={{ color: pass ? "var(--color-success)" : "var(--color-text)" }}>
                {pass ? "✓" : "○"} {r.label}
              </li>
            );
          })}
          <li style={{ color: matches ? "var(--color-success)" : "var(--color-text)" }}>
            {matches ? "✓" : "○"} Passwords match
          </li>
        </ul>

        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between" }}>
          <button type="button" className="btn btn-tertiary" onClick={() => logout()}>
            Cancel and sign out
          </button>
          <Button type="submit" variant="primary" disabled={!canSubmit} busy={busy}>
            Continue
          </Button>
        </div>
      </form>
    </div>
  );
}
