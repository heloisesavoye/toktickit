import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/Button";

// ui-spec.md §2. Replaces the Lab 2 Development Requester Selection screen.
export function Login() {
  const { login, loginError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
    } catch {
      // loginError is already set by the context; nothing else to do.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: "64px auto" }}>
      <h1>Sign in to your account</h1>

      {loginError && (
        <div className="callout callout-error" role="alert">
          {loginError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">
            Email address<span className="required">*</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">
            Password<span className="required">*</span>
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-tertiary"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <Button type="submit" variant="primary" busy={busy} busyLabel="Signing in…" style={{ width: "100%" }}>
            Sign In
          </Button>
        </div>
      </form>

      <p style={{ marginTop: 16, textAlign: "center" }}>
        <span
          className="btn-tertiary"
          style={{ opacity: 0.6, cursor: "not-allowed" }}
          title="Contact your Administrator"
        >
          Forgot your password?
        </span>
      </p>
    </div>
  );
}
