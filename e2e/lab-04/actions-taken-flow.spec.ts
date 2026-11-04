import { test, expect } from "@playwright/test";
import { STAFF, STAFF2, SARAH, ADMIN, API_BASE, login, nav, shot, createTicketAs, expectNoHorizontalScroll } from "./helpers";

// E2E-01 (AC-01, AC-05, AC-11, AC-13) + Part 6 evidence: list, create, assign,
// edit, complete, cancel, validation, and several Actions Taken on one Ticket.
test("IT Staff records, edits, completes and cancels Actions Taken on one Ticket", async ({ page }, testInfo) => {
  const p = testInfo.project.name;
  const ticket = await createTicketAs(page, SARAH, `E2E actions ${p} ${Date.now()}`);

  await login(page, STAFF);
  await nav(page, /ticket queue/i).click();
  await page.getByPlaceholder(/search by ticket number or summary/i).fill(ticket.ticketNumber);
  await page.getByText(ticket.ticketNumber).click();
  const section = page.getByRole("region", { name: "Actions Taken" });
  await expect(section.getByText(/No actions recorded yet/i)).toBeVisible();

  // Validation: follow-up required without a note.
  await section.getByRole("button", { name: /add action/i }).click();
  await section.getByLabel(/Action Description/i).fill("Checked VPN client logs on the laptop");
  await section.getByLabel(/^Result/i).fill("Certificate expired");
  await section.getByLabel("Yes").check();
  await section.getByRole("button", { name: /save action/i }).click();
  await expect(section.getByText(/Follow-up note is required/i)).toBeVisible();
  await shot(page, "actions-taken", p, "validation");
  await section.getByLabel(/Follow-up Note/i).fill("Renew certificate with the PKI team");
  await section.getByRole("button", { name: /save action/i }).click();
  await expect(section.getByRole("status")).toHaveText(/Action saved/i);

  // Second action performed by me but assigned to a colleague.
  await section.getByRole("button", { name: /add action/i }).click();
  await section.getByLabel(/Action Description/i).fill("Renewed the VPN client certificate");
  await section.getByLabel(/^Result/i).fill("Pending verification by requester");
  await section.getByLabel(/Assignee/i).selectOption({ label: STAFF2.name });
  await section.getByRole("button", { name: /save action/i }).click();
  await expect(section.getByText("Renewed the VPN client certificate")).toBeVisible();
  await expect(section.getByText(STAFF2.name)).toBeVisible();
  await shot(page, "actions-taken", p, "list");
  await expectNoHorizontalScroll(page);

  // Edit the first action, then complete it.
  await section.getByRole("button", { name: /view or edit action/i }).first().click();
  await section.getByLabel(/^Result/i).fill("Certificate expired on 1 Nov");
  await section.getByRole("button", { name: /save changes/i }).click();
  await expect(section.getByText("Certificate expired on 1 Nov")).toBeVisible();
  await section.getByRole("button", { name: /view or edit action/i }).first().click();
  await section.getByRole("button", { name: /mark completed/i }).click();
  await expect(section.getByText("Completed").first()).toBeVisible();

  // Completed action opens read-only.
  await section.getByRole("button", { name: /view or edit action/i }).first().click();
  await expect(section.getByLabel(/Action Description/i)).toHaveAttribute("readonly", "");
  await expect(section.getByRole("button", { name: /mark completed/i })).toHaveCount(0);
  await shot(page, "actions-taken", p, "read-only");
  await section.getByRole("button", { name: /^back$/i }).click();

  // Cancel the second action through the confirmation dialog.
  await section.getByRole("button", { name: /view or edit action/i }).nth(1).click();
  await section.getByRole("button", { name: /cancel action/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /cancel action/i }).click();
  await expect(section.getByText("Cancelled").first()).toBeVisible();
  await shot(page, "actions-taken", p);
});

test("inactive assignee and Requester calls are rejected by the backend", async ({ page }, testInfo) => {
  const ticket = await createTicketAs(page, SARAH, `E2E roles ${testInfo.project.name} ${Date.now()}`);
  const ctx = page.context().request;

  // Requester session cannot create an Action Taken (AC-07).
  await ctx.post(`${API_BASE}/auth/login`, { data: SARAH });
  const asRequester = await ctx.post(`${API_BASE}/staff/tickets/${ticket.id}/actions`, {
    data: { description: "Sneaky requester action", result: "should fail" },
  });
  expect(asRequester.status()).toBe(403);
  await ctx.post(`${API_BASE}/auth/logout`);

  // Look up the seeded inactive IT Staff account as Administrator...
  await ctx.post(`${API_BASE}/auth/login`, { data: ADMIN });
  const users = await (await ctx.get(`${API_BASE}/admin/users?search=former.itstaff`)).json();
  const inactive = users.data.find((u: any) => u.email === "former.itstaff@toktickit.local");
  expect(inactive?.isActive).toBe(false);

  // ...then try to assign an Action Taken to it (AC-06).
  const res = await ctx.post(`${API_BASE}/staff/tickets/${ticket.id}/actions`, {
    data: { description: "Assign to a former colleague", result: "should fail", assigneeId: inactive.id },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error.code).toBe("INVALID_ASSIGNEE");
  await ctx.post(`${API_BASE}/auth/logout`);
});
