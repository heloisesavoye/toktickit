import { test, expect } from "@playwright/test";

// Lab 2 requester flow, updated for Lab 3 authentication (the temporary
// "Development Requester" selector was removed in Lab 3, so the original
// selector-based steps can no longer run). Behavior under test is unchanged:
// E2E-01 (AC-01, AC-05) create a ticket and see the official number;
// E2E-02 (AC-15) a Requester never sees another Requester's tickets.

const JENNIFER = { email: "jennifer.anderson@example.com", password: "RequesterDev123!" };
const SARAH = { email: "sarah.johnson@example.com", password: "RequesterDev123!" };

async function login(page: import("@playwright/test").Page, who: { email: string; password: string }) {
  await page.goto("/");
  await page.getByLabel(/Email address/i).fill(who.email);
  await page.getByLabel(/^Password/i).fill(who.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /welcome, /i })).toBeVisible();
}

test("requester creates a ticket and sees the generated ticket number", async ({ page }) => {
  await login(page, JENNIFER);
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: /create ticket/i }).click();
  await page.getByLabel(/Ticket Summary/i).fill("Laptop battery drains quickly");
  await page.getByLabel(/Description/i).fill("The battery drains fast even when idle.");
  await page.getByRole("button", { name: /submit ticket/i }).click();
  await expect(page.getByText(/TKT-\d{4}-\d{6}/).first()).toBeVisible();
});

test("a Requester's My Tickets never shows another Requester's tickets", async ({ page }) => {
  await login(page, SARAH);
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: /^my tickets$/i }).click();
  await expect(page.getByRole("heading", { name: /^my tickets$/i })).toBeVisible();
  // Jennifer's seeded tickets (TKT-2026-000001/2) must not appear for Sarah.
  await expect(page.locator("tbody")).not.toContainText("TKT-2026-000001");
  await expect(page.locator("tbody")).not.toContainText("TKT-2026-000002");
});
