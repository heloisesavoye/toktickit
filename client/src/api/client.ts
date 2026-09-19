const BASE = (import.meta as any).env?.VITE_API_BASE ?? "http://localhost:4000/api";

export class ApiError extends Error {
  code?: string;
  fields?: Record<string, string>;
  status: number;
  constructor(status: number, code?: string, fields?: Record<string, string>) {
    super(code ?? "REQUEST_FAILED");
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.code, body?.error?.fields);
  }
  return body;
}

export const api = {
  getRequesters: () => request("/requesters"),
  getCategories: () => request("/categories"),
  getRelatedSystems: () => request("/related-systems"),
  createTicket: (data: unknown) =>
    request("/tickets", { method: "POST", body: JSON.stringify(data) }),
  listTickets: (params: URLSearchParams) => request(`/tickets?${params.toString()}`),
  getTicket: (id: number, requesterId: number) =>
    request(`/tickets/${id}?requesterId=${requesterId}`),
  uploadAttachment: (ticketId: number, requesterId: number, file: File) => {
    const form = new FormData();
    form.append("requesterId", String(requesterId));
    form.append("file", file);
    return request(`/tickets/${ticketId}/attachments`, { method: "POST", body: form });
  },
  removeAttachment: (id: number, requesterId: number, removalReason: string) =>
    request(`/attachments/${id}/remove`, {
      method: "POST",
      body: JSON.stringify({ requesterId, removalReason }),
    }),
  downloadUrl: (id: number, requesterId: number) =>
    `${BASE}/attachments/${id}/download?requesterId=${requesterId}`,
};
