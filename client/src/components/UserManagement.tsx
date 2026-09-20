import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  isActive: boolean;
};

type PanelMode = "closed" | "create" | { edit: UserRow };

const ROLE_LABEL: Record<UserRow["role"], string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

function randomPassword() {
  // Purely random draws from a mixed charset don't guarantee coverage of
  // every character class the server's validatePasswordPolicy requires
  // (upper/lower/digit/special) — a 12-character password drawn this way
  // fails that policy roughly a third of the time. Guarantee one of each
  // required class first, then fill the rest randomly and shuffle so the
  // required characters aren't always in the same positions.
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%";
  const all = upper + lower + digits + special;

  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  const required = [pick(upper), pick(lower), pick(digits), pick(special)];
  const rest = Array.from({ length: 8 }, () => pick(all));

  const out = [...required, ...rest];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}

// Administrator User Management per ui-spec.md §8 and api-spec.md §5.
export function UserManagement() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [panel, setPanel] = useState<PanelMode>("closed");

  function load() {
    setLoadState("loading");
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (roleFilter) params.set("role", roleFilter);
    api
      .listUsers(params)
      .then((res) => {
        setUsers(res.data);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }

  useEffect(load, [search, roleFilter]);

  const activeAdminCount = users.filter((u) => u.role === "ADMINISTRATOR" && u.isActive).length;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1>Users</h1>
          <p>Create accounts, assign one role, and manage activation.</p>
        </div>
        <Button variant="primary" onClick={() => setPanel("create")}>+ Create User</Button>
      </div>

      <div style={{ display: "flex", gap: 12, margin: "16px 0", flexWrap: "wrap" }}>
        <input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 220, padding: 10, borderRadius: 8, border: "1px solid var(--color-border)" }}
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          <option value="REQUESTER">Requester</option>
          <option value="IT_STAFF">IT Staff</option>
          <option value="ADMINISTRATOR">Administrator</option>
        </select>
      </div>

      {loadState === "loading" && <p role="status">Loading users…</p>}
      {loadState === "error" && <div className="callout callout-error" role="alert">Unable to load users. Please try again.</div>}
      {loadState === "ready" && users.length === 0 && <div className="callout">No users match your search.</div>}

      {loadState === "ready" && users.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>
              <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td><Badge label={ROLE_LABEL[u.role]} variant="status" /></td>
                <td>
                  <span style={{ color: u.isActive ? "var(--color-success)" : "var(--color-error)" }}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <Button variant="tertiary" onClick={() => setPanel({ edit: u })}>Edit</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {panel === "create" && (
        <CreateUserPanel onClose={() => setPanel("closed")} onSaved={() => { setPanel("closed"); load(); }} />
      )}
      {typeof panel === "object" && (
        <EditUserPanel
          user={panel.edit}
          isSelf={panel.edit.id === me?.id}
          isLastActiveAdmin={panel.edit.role === "ADMINISTRATOR" && panel.edit.isActive && activeAdminCount <= 1}
          onClose={() => setPanel("closed")}
          onSaved={() => { setPanel("closed"); load(); }}
        />
      )}
    </div>
  );
}

function CreateUserPanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRow["role"]>("REQUESTER");
  const [isActive, setIsActive] = useState(true);
  const [initialPassword, setInitialPassword] = useState(randomPassword());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setApiError(null);
    setFieldErrors({});
    try {
      await api.createUser({ name, email, role, isActive, initialPassword });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "EMAIL_IN_USE") setFieldErrors({ email: "This email is already in use." });
        else if (err.fields) setFieldErrors(err.fields);
        else setApiError("Unable to create this user right now. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SlideOver title="Create New User" onClose={onClose}>
      {apiError && <div className="callout callout-error" role="alert">{apiError}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field" data-invalid={!!fieldErrors.name}>
          <label htmlFor="fullName">Full Name<span className="required">*</span></label>
          <input id="fullName" value={name} onChange={(e) => setName(e.target.value)} required />
          {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
        </div>
        <div className="field" data-invalid={!!fieldErrors.email}>
          <label htmlFor="createEmail">Email Address<span className="required">*</span></label>
          <input id="createEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
        </div>
        <div className="field">
          <label htmlFor="role">Role<span className="required">*</span></label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value as UserRow["role"])}>
            <option value="REQUESTER">Requester</option>
            <option value="IT_STAFF">IT Staff</option>
            <option value="ADMINISTRATOR">Administrator</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="active">Active</label>
          <select id="active" value={isActive ? "yes" : "no"} onChange={(e) => setIsActive(e.target.value === "yes")}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="field" data-invalid={!!fieldErrors.initialPassword}>
          <label htmlFor="initialPassword">Initial Password<span className="required">*</span></label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="initialPassword"
              value={initialPassword}
              onChange={(e) => setInitialPassword(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-tertiary" onClick={() => setInitialPassword(randomPassword())}>
              Generate
            </button>
          </div>
          <span style={{ fontSize: 12, color: "#6B7A70" }}>The user must change this at their next login.</span>
          {fieldErrors.initialPassword && <span className="field-error">{fieldErrors.initialPassword}</span>}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" busy={busy}>Save User</Button>
        </div>
      </form>
    </SlideOver>
  );
}

function EditUserPanel({
  user,
  isSelf,
  isLastActiveAdmin,
  onClose,
  onSaved,
}: {
  user: UserRow;
  isSelf: boolean;
  isLastActiveAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showPasswordField, setShowPasswordField] = useState(false);
  const [newPassword, setNewPassword] = useState(randomPassword());

  const deactivateDisabled = isSelf || (isLastActiveAdmin && (isActive || role !== "ADMINISTRATOR"));
  const deactivateTooltip = isSelf
    ? "You cannot deactivate your own account."
    : isLastActiveAdmin
    ? "At least one active Administrator must remain."
    : undefined;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setApiError(null);
    setFieldErrors({});
    try {
      await api.updateUser(user.id, { name, email, role, isActive });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "EMAIL_IN_USE") setFieldErrors({ email: "This email is already in use." });
        else if (err.fields) setFieldErrors(err.fields);
        else setApiError(err.message2 ?? "Unable to save changes right now. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSetPassword() {
    setBusy(true);
    setApiError(null);
    try {
      await api.setUserPassword(user.id, newPassword);
      onSaved();
    } catch {
      setApiError("Unable to set a new password right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleToggleActive() {
    if (deactivateDisabled && isActive) return;
    setIsActive((v) => !v);
  }

  return (
    <SlideOver title={`Edit ${user.name}`} onClose={onClose}>
      {apiError && <div className="callout callout-error" role="alert">{apiError}</div>}
      <form onSubmit={handleSave}>
        <div className="field" data-invalid={!!fieldErrors.name}>
          <label htmlFor="editName">Full Name</label>
          <input id="editName" value={name} onChange={(e) => setName(e.target.value)} />
          {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
        </div>
        <div className="field" data-invalid={!!fieldErrors.email}>
          <label htmlFor="editEmail">Email Address</label>
          <input id="editEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
        </div>
        <div className="field">
          <label htmlFor="editRole">Role</label>
          <select id="editRole" value={role} onChange={(e) => setRole(e.target.value as UserRow["role"])}>
            <option value="REQUESTER">Requester</option>
            <option value="IT_STAFF">IT Staff</option>
            <option value="ADMINISTRATOR">Administrator</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="editActive">Active</label>
          <input id="editActive" type="checkbox" checked={isActive} onChange={handleToggleActive} disabled={deactivateDisabled && isActive} />
          {deactivateTooltip && isActive && <span style={{ fontSize: 12, color: "#6B7A70" }} title={deactivateTooltip}>{deactivateTooltip}</span>}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" busy={busy}>Save Changes</Button>
        </div>
      </form>

      <hr style={{ margin: "24px 0" }} />

      {!showPasswordField ? (
        <Button variant="secondary" onClick={() => setShowPasswordField(true)}>Set New Initial Password</Button>
      ) : (
        <div className="callout">
          This forces {user.name} to change their password at next login and signs them out everywhere.
          <div className="field" style={{ marginTop: 8 }}>
            <label htmlFor="newInitialPassword">New Initial Password</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="newInitialPassword" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ flex: 1 }} />
              <button type="button" className="btn btn-tertiary" onClick={() => setNewPassword(randomPassword())}>Generate</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Button variant="primary" busy={busy} onClick={handleSetPassword}>Confirm</Button>
            <Button variant="tertiary" onClick={() => setShowPasswordField(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </SlideOver>
  );
}

function SlideOver({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginTop: 16, borderColor: "var(--color-secondary)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>{title}</h2>
        <button className="btn btn-tertiary" onClick={onClose} aria-label="Close">✕</button>
      </div>
      {children}
    </div>
  );
}
