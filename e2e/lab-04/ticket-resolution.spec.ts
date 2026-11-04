import { test, expect } from "@playwright/test";
import { STAFF, SARAH, login, nav, shot, createTicketAs } from "./helpers";

// E2E-02 (AC-03, AC-04, AC-19) + E2E-03 (AC-08) + Part 7 evidence:
// permitted transitions only, resolution gate, status history, and the
// Requester's read-only view of Actions Taken.
test("resolution is blocked until an action is completed, then succeeds", async ({ page }, testInfo) => {
  const p = testInfo.project.name;
  const ticket = await createTicketAs(page, SARAH, `E2E resolve ${p} ${Date.now()}`);

  await login(page, STAFF);
  await nav(page, /ticket queue/i).click();
  await page.getByPlaceholder(/search by ticket number or summary/i).fill(ticket.ticketNumber);
  await page.getByText(ticket.ticketNumber).click();

  const status = page.getByLabel(/Current Status/i);
  // NEW → only Open / In Progress / Cancelled are offered (§9).
  const options = await status.locator("option").evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
  expect(options).toEqual(["NEW", "OPEN", "IN_PROGRESS", "CANCELLED"]);

  await status.selectOption("IN_PROGRESS");
  await expect(status).toHaveValue("IN_PROGRESS");
  const resolved = status.locator('option[value="RESOLVED"]');
  await expect(resolved).toBeDisabled();
  await expect(page.getByText(/complete at least one Action Taken/i)).toBeVisible();
  await shot(page, "actions-taken", p, "resolution-blocked");

  // Bypass the UI: the backend still refuses (BR-08).
  const direct = await page.context().request.patch(`http://localhost:3000/api/staff/tickets/${ticket.id}/status`, {
    data: { currentStatus: "RESOLVED" },
  });
  expect(direct.status()).toBe(409);
  expect((await direct.json()).error.code).toBe("RESOLUTION_BLOCKED");

  // Record and complete one action, then resolve.
  const section = page.getByRole("region", { name: "Actions Taken" });
  await section.getByRole("button", { name: /add action/i }).click();
  await section.getByLabel(/Action Description/i).fill("Reset the user's VPN profile");
  await section.getByLabel(/^Result/i).fill("Requester confirmed the connection works");
  await section.getByRole("button", { name: /save action/i }).click();
  await section.getByRole("button", { name: /view or edit action/i }).first().click();
  await section.getByRole("button", { name: /mark completed/i }).click();
  await expect(section.getByText("Completed").first()).toBeVisible();

  await expect(resolved).toBeEnabled();
  await status.selectOption("RESOLVED");
  await expect(status).toHaveValue("RESOLVED");
  await expect(page.getByText(/Status history/i)).toBeVisible();
  await expect(page.locator(".history-list li")).toHaveCount(2);
  await shot(page, "actions-taken", p, "resolved");

  // Requester sees the actions read-only (E2E-03).
  await page.getByRole("button", { name: /logout/i }).click();
  await login(page, SARAH);
  await nav(page, /^my tickets$/i).click();
  await page.getByText(ticket.ticketNumber).click();
  const reqSection = page.getByRole("region", { name: /Actions Taken by IT Support/i });
  await expect(reqSection.getByText("Reset the user's VPN profile")).toBeVisible();
  await expect(reqSection.getByRole("button")).toHaveCount(0);
  await expect(page.getByText(/Internal Notes/i)).toHaveCount(0);
  await shot(page, "actions-taken", p, "requester-view");
});
