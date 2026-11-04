const BASE = (import.meta as any).env?.VITE_API_BASE ?? "http://localhost:4000/api";

export class ApiError extends Error {
  code?: string;
  current?: any; // Lab 4: STALE_UPDATE returns the latest record
  fields?: Record<string, string>;
  message2?: string;
  status: number;
  constructor(status: number, code?: string, fields?: Record<string, string>, message2?: string) {
    super(code ?? "REQUEST_FAILED");
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.message2 = message2;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include", // Lab 3: session cookie must travel with every request.
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new ApiError(res.status, body?.error?.code, body?.error?.fields, body?.error?.message);
    if (body?.current !== undefined) err.current = body.current;
    throw err;
  }
  return body;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  changePassword: (currentPassword: string, newPassword: string) =>
    request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // Reference data
  getCategories: () => request("/categories"),
  getRelatedSystems: () => request("/related-systems"),

  // Requester tickets (identity from session cookie)
  createTicket: (data: unknown) =>
    request("/tickets", { method: "POST", body: JSON.stringify(data) }),
  listTickets: (params: URLSearchParams) => request(`/tickets?${params.toString()}`),
  getTicket: (id: number) => request(`/tickets/${id}`),
  markAppearsResolved: (id: number) => request(`/tickets/${id}/resolution-flag`, { method: "POST" }),
  uploadAttachment: (ticketId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request(`/tickets/${ticketId}/attachments`, { method: "POST", body: form });
  },
  removeAttachment: (id: number, removalReason: string) =>
    request(`/attachments/${id}/remove`, { method: "POST", body: JSON.stringify({ removalReason }) }),
  downloadUrl: (id: number) => `${BASE}/attachments/${id}/download`,

  // Comments / notes (shared by Requester and IT Staff/Administrator)
  getComments: (ticketId: number) => request(`/tickets/${ticketId}/comments`),
  postComment: (ticketId: number, content: string) =>
    request(`/tickets/${ticketId}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
  getNotes: (ticketId: number) => request(`/tickets/${ticketId}/notes`),
  postNote: (ticketId: number, content: string) =>
    request(`/tickets/${ticketId}/notes`, { method: "POST", body: JSON.stringify({ content }) }),

  // IT Staff
  listStaffTickets: (params: URLSearchParams) => request(`/staff/tickets?${params.toString()}`),
  getStaffTicket: (id: number) => request(`/staff/tickets/${id}`),
  claimTicket: (id: number) => request(`/staff/tickets/${id}/claim`, { method: "POST" }),
  assignTicket: (id: number, ownerId: number) =>
    request(`/staff/tickets/${id}/assign`, { method: "POST", body: JSON.stringify({ ownerId }) }),
  setItPriority: (id: number, itPriority: string) =>
    request(`/staff/tickets/${id}/priority`, { method: "PATCH", body: JSON.stringify({ itPriority }) }),
  setStatus: (id: number, currentStatus: string, expectedVersion?: number) =>
    request(`/staff/tickets/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(expectedVersion === undefined ? { currentStatus } : { currentStatus, expectedVersion }),
    }),

  // Lab 4: Actions Taken (docs/lab-04/api-spec.md §2)
  listAssignees: () => request("/staff/assignees"),
  listActions: (ticketId: number) => request(`/staff/tickets/${ticketId}/actions`),
  createAction: (ticketId: number, data: unknown) =>
    request(`/staff/tickets/${ticketId}/actions`, { method: "POST", body: JSON.stringify(data) }),
  updateAction: (actionId: number, data: unknown) =>
    request(`/staff/actions/${actionId}`, { method: "PATCH", body: JSON.stringify(data) }),
  completeAction: (actionId: number, version: number) =>
    request(`/staff/actions/${actionId}/complete`, { method: "POST", body: JSON.stringify({ version }) }),
  cancelAction: (actionId: number, version: number) =>
    request(`/staff/actions/${actionId}/cancel`, { method: "POST", body: JSON.stringify({ version }) }),

  // Lab 4: dashboards (api-spec.md §4)
  getRequesterDashboard: () => request("/dashboard/requester"),
  getStaffDashboard: () => request("/dashboard/staff"),

  // Administrator user management
  listUsers: (params: URLSearchParams) => request(`/admin/users?${params.toString()}`),
  createUser: (data: unknown) => request("/admin/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: number, data: unknown) =>
    request(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  setUserPassword: (id: number, newInitialPassword: string) =>
    request(`/admin/users/${id}/password`, {
      method: "POST",
      body: JSON.stringify({ newInitialPassword }),
    }),
};
