import { test, expect } from "@playwright/test";

// Lab 3 responsive evidence screenshots (ui-spec.md §5-8). Run across the
// desktop/tablet/mobile projects defined in playwright.config.ts; each test
// saves to artifacts/lab-03/screenshots/<screen>/<project>.png.
//
// Requires both dev servers running locally:
//   server: npm run dev   (http://localhost:3000)
//   client: npm run dev   (http://localhost:5173)

const REQUESTER = { email: "jennifer.anderson@example.com", password: "RequesterDev123!" };
const STAFF = { email: "priya.nakamura@toktickit.local", password: "StaffDev123!" };
const ADMIN = { email: "admin@toktickit.local", password: "AdminDev123!" };

async function login(page: import("@playwright/test").Page, creds: { email: string; password: string }) {
  await page.goto("/");
  await page.getByLabel(/Email address/i).fill(creds.email);
  await page.getByLabel(/^Password/i).fill(creds.password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

test("Login screen", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /sign in to your account/i })).toBeVisible();
  await page.screenshot({
    path: `artifacts/lab-03/screenshots/login/${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("IT Staff Ticket Queue", async ({ page }, testInfo) => {
  await login(page, STAFF);
  await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
  await page.screenshot({
    path: `artifacts/lab-03/screenshots/staff-ticket-queue/${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("IT Staff Ticket Detail", async ({ page }, testInfo) => {
  await login(page, STAFF);
  await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
  await page.getByText("TKT-2026-000001").click();
  await expect(page.getByText(/Public Comments/i)).toBeVisible();
  await page.screenshot({
    path: `artifacts/lab-03/screenshots/staff-ticket-detail/${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("Administrator User Management", async ({ page }, testInfo) => {
  await login(page, ADMIN);
  await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
  await page.getByRole("button", { name: /^admin$/i }).click();
  await expect(page.getByRole("heading", { name: /^users$/i })).toBeVisible();
  await page.screenshot({
    path: `artifacts/lab-03/screenshots/admin-user-management/${testInfo.project.name}.png`,
    fullPage: true,
  });
});
