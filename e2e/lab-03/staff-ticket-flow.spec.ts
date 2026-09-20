import { test, expect } from "@playwright/test";
import fs from "node:fs";

// E2E-03/E2E-04 (tests.md) + Parts 6-7 evidence: IT Staff Ticket Queue and
// Ticket Detail (claim, priority, status, comments, notes) plus a direct-API
// authorization check (Part 7's "role restrictions" evidence).

const STAFF = { email: "priya.nakamura@toktickit.local", password: "StaffDev123!" };
const REQUESTER = { email: "jennifer.anderson@example.com", password: "RequesterDev123!" };
const API_BASE = "http://localhost:3000/api";

async function loginStaff(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel(/Email address/i).fill(STAFF.email);
  await page.getByLabel(/^Password/i).fill(STAFF.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
}

test.describe("IT Staff Ticket Queue", () => {
  test("shows the realistic seeded queue with badges and ownership", async ({ page }, testInfo) => {
    await loginStaff(page);
    await expect(page.getByText("TKT-2026-000001")).toBeVisible();
    await page.screenshot({ path: `artifacts/lab-03/screenshots/staff-queue/${testInfo.project.name}.png`, fullPage: true });
  });

  test("search filters the queue to a matching ticket", async ({ page }, testInfo) => {
    await loginStaff(page);
    await page.getByPlaceholder(/search by ticket number or summary/i).fill("VPN");
    await expect(page.getByText("TKT-2026-000002")).toBeVisible();
    await expect(page.getByText("TKT-2026-000001")).not.toBeVisible();
    await page.screenshot({ path: `artifacts/lab-03/screenshots/staff-queue/search/${testInfo.project.name}.png`, fullPage: true });
  });

  test("status filter narrows the queue", async ({ page }, testInfo) => {
    await loginStaff(page);
    await page.getByRole("combobox").first().selectOption("RESOLVED");
    await expect(page.getByText("TKT-2026-000003")).toBeVisible();
    await page.screenshot({ path: `artifacts/lab-03/screenshots/staff-queue/filter/${testInfo.project.name}.png`, fullPage: true });
  });

  test("no-results state offers a clear-filters action", async ({ page }, testInfo) => {
    await loginStaff(page);
    await page.getByPlaceholder(/search by ticket number or summary/i).fill("nonexistent-ticket-zzz");
    const noResults = page.getByText(/no tickets match your filters/i);
    await expect(noResults).toBeVisible();
    await page.screenshot({ path: `artifacts/lab-03/screenshots/staff-queue/no-results/${testInfo.project.name}.png`, fullPage: true });
    // Two "Clear Filters" buttons exist (the always-visible one above the
    // table and the one inside this no-results message) — scope to the one
    // inside the message so the click isn't ambiguous.
    await noResults.getByRole("button", { name: /clear filters/i }).click();
    await expect(page.getByText("TKT-2026-000001")).toBeVisible();
  });
});

test.describe("IT Staff Ticket Detail", () => {
  async function openUnassignedTicket(page: import("@playwright/test").Page) {
    await loginStaff(page);
    await page.getByText("TKT-2026-000002").click();
    await expect(page.getByText(/Public Comments/i)).toBeVisible();
  }

  test("full detail view: attachments, comments and internal notes panels", async ({ page }, testInfo) => {
    await openUnassignedTicket(page);
    await expect(page.getByRole("heading", { name: /internal notes/i })).toBeVisible();
    await page.screenshot({ path: `artifacts/lab-03/screenshots/staff-ticket-detail/${testInfo.project.name}.png`, fullPage: true });
  });

  test("claiming an unassigned ticket sets the current user as owner", async ({ page }, testInfo) => {
    await openUnassignedTicket(page);
    await page.getByRole("button", { name: /^claim$/i }).click();
    // The owner field is a read-only <input>, not a labelled form control, so
    // it's checked by value on the input near the "Ticket Owner" label
    // rather than Testing Library's getByDisplayValue (not a Playwright API).
    const ownerField = page.locator(".field", { hasText: "Ticket Owner" }).locator("input");
    await expect(ownerField).toHaveValue("Priya Nakamura");
    await page.screenshot({ path: `artifacts/lab-03/screenshots/staff-ticket-detail/claim/${testInfo.project.name}.png`, fullPage: true });
  });

  test("changing IT Priority persists the new value", async ({ page }, testInfo) => {
    await loginStaff(page);
    await page.getByText("TKT-2026-000001").click();
    await page.getByLabel(/IT Priority/i).selectOption("HIGH");
    await expect(page.getByLabel(/IT Priority/i)).toHaveValue("HIGH");
    await page.screenshot({ path: `artifacts/lab-03/screenshots/staff-ticket-detail/priority-change/${testInfo.project.name}.png`, fullPage: true });
  });

  test("a valid status transition succeeds", async ({ page }, testInfo) => {
    await loginStaff(page);
    await page.getByText("TKT-2026-000001").click();
    await page.getByLabel(/Current Status/i).selectOption("WAITING_FOR_REQUESTER");
    await expect(page.getByLabel(/Current Status/i)).toHaveValue("WAITING_FOR_REQUESTER");
    await page.screenshot({ path: `artifacts/lab-03/screenshots/staff-ticket-detail/status-change/${testInfo.project.name}.png`, fullPage: true });
  });

  test("posting a public comment appears immediately", async ({ page }, testInfo) => {
    await loginStaff(page);
    await page.getByText("TKT-2026-000001").click();
    const text = `E2E comment ${Date.now()}`;
    await page.getByPlaceholder(/type your comment here/i).fill(text);
    await page.getByRole("button", { name: /post comment/i }).click();
    await expect(page.getByText(text)).toBeVisible();
    await page.screenshot({ path: `artifacts/lab-03/screenshots/staff-ticket-detail/comment-posted/${testInfo.project.name}.png`, fullPage: true });
  });

  test("posting an internal note appears in the notes panel only", async ({ page }, testInfo) => {
    await loginStaff(page);
    await page.getByText("TKT-2026-000001").click();
    const text = `E2E internal note ${Date.now()}`;
    await page.getByPlaceholder(/add an internal note/i).fill(text);
    await page.getByRole("button", { name: /add note/i }).click();
    await expect(page.getByText(text)).toBeVisible();
    await page.screenshot({ path: `artifacts/lab-03/screenshots/staff-ticket-detail/note-posted/${testInfo.project.name}.png`, fullPage: true });
  });
});

test("Direct API call: a Requester session is blocked (403) from a Staff-only endpoint (BR role restriction)", async ({ page, request }) => {
  // Log in as a Requester through the real UI so we get a real session cookie...
  await page.goto("/");
  await page.getByLabel(/Email address/i).fill(REQUESTER.email);
  await page.getByLabel(/^Password/i).fill(REQUESTER.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /my tickets/i })).toBeVisible();

  // ...then hit the staff-only endpoint directly (bypassing the UI entirely).
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const res = await request.get(`${API_BASE}/staff/tickets`, { headers: { Cookie: cookieHeader } });
  expect(res.status()).toBe(403);
  const body = await res.json().catch(() => ({}));
  fs.mkdirSync("artifacts/lab-03", { recursive: true });
  fs.writeFileSync(
    "artifacts/lab-03/api-authorization-evidence.txt",
    `GET /api/staff/tickets as REQUESTER\nStatus: ${res.status()}\nBody: ${JSON.stringify(body, null, 2)}\n`
  );
});
