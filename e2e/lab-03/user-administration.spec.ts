import { test, expect } from "@playwright/test";

// E2E-05/E2E-06 (tests.md) + Part 8 evidence: Administrator User Management.

const ADMIN = { email: "admin@toktickit.local", password: "AdminDev123!" };
const STAFF = { email: "priya.nakamura@toktickit.local", password: "StaffDev123!" };
const API_BASE = "http://localhost:3000/api";

async function loginAdmin(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel(/Email address/i).fill(ADMIN.email);
  await page.getByLabel(/^Password/i).fill(ADMIN.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
  await page.getByRole("button", { name: /^admin$/i }).click();
  await expect(page.getByRole("heading", { name: /^users$/i })).toBeVisible();
}

test("lists seeded users with role and status, plus search and role filter", async ({ page }, testInfo) => {
  await loginAdmin(page);
  // Scoped to the users table: the logged-in admin's own name also appears
  // in the page banner, which would otherwise make these matches ambiguous
  // (or, for "not visible", falsely still-visible via the banner).
  const table = page.getByRole("table");
  await expect(table.getByText("Alex Thompson")).toBeVisible();
  await page.screenshot({ path: `artifacts/lab-03/screenshots/user-management/${testInfo.project.name}.png`, fullPage: true });

  await page.getByPlaceholder(/search by name or email/i).fill("Priya");
  await expect(table.getByText("Priya Nakamura")).toBeVisible();
  await expect(table.getByText("Alex Thompson")).not.toBeVisible();
  await page.screenshot({ path: `artifacts/lab-03/screenshots/user-management/search/${testInfo.project.name}.png`, fullPage: true });

  await page.getByPlaceholder(/search by name or email/i).fill("");
  await page.getByRole("combobox").selectOption("ADMINISTRATOR");
  await expect(table.getByText("Alex Thompson")).toBeVisible();
  await expect(table.getByText("Priya Nakamura")).not.toBeVisible();
  await page.screenshot({ path: `artifacts/lab-03/screenshots/user-management/role-filter/${testInfo.project.name}.png`, fullPage: true });
});

test("creating a user with a duplicate email is rejected with field-level validation", async ({ page }, testInfo) => {
  await loginAdmin(page);
  await page.getByRole("button", { name: /create user/i }).click();
  await page.getByLabel(/Full Name/i).fill("Duplicate Test");
  await page.getByLabel(/Email Address/i).fill(ADMIN.email); // already exists
  await page.getByRole("button", { name: /save user/i }).click();
  await expect(page.getByText(/this email is already in use/i)).toBeVisible();
  await page.screenshot({ path: `artifacts/lab-03/screenshots/user-management/validation-error/${testInfo.project.name}.png`, fullPage: true });
});

test("creating a new user with a generated initial password succeeds", async ({ page }, testInfo) => {
  await loginAdmin(page);
  await page.getByRole("button", { name: /create user/i }).click();
  // Unique per run (not just per email): the dev database persists between
  // runs/projects, so a static name like "E2E Test User" collides with rows
  // left over from earlier runs and makes the assertion below ambiguous.
  const suffix = Date.now();
  const email = `e2e.user.${suffix}@toktickit.local`;
  const name = `E2E Test User ${suffix}`;
  await page.getByLabel(/Full Name/i).fill(name);
  await page.getByLabel(/Email Address/i).fill(email);
  await page.screenshot({ path: `artifacts/lab-03/screenshots/user-management/create/${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: /save user/i }).click();
  await expect(page.getByText(name)).toBeVisible();
});

test("editing a user's details saves changes", async ({ page }, testInfo) => {
  await loginAdmin(page);
  const row = page.locator("tr", { hasText: "Chalermchai Suk" });
  await row.getByRole("button", { name: /edit/i }).click();
  await page.getByLabel(/Full Name/i).fill("Chalermchai Suk (Updated)");
  await page.screenshot({ path: `artifacts/lab-03/screenshots/user-management/edit/${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: /save changes/i }).click();
  // Scoped to the table: the edit panel's own "Edit Chalermchai Suk
  // (Updated)" heading contains the same text and briefly overlaps with the
  // table during the panel's close transition, which is ambiguous otherwise.
  await expect(page.getByRole("table").getByText("Chalermchai Suk (Updated)")).toBeVisible();
});

test("setting a new initial password forces a password change at next login", async ({ page, request }, testInfo) => {
  await loginAdmin(page);
  const row = page.locator("tr", { hasText: "Emma Wilson" });
  await row.getByRole("button", { name: /edit/i }).click();
  await page.getByRole("button", { name: /set new initial password/i }).click();
  const newPassword = "ResetByAdmin1!";
  await page.getByLabel(/New Initial Password/i).fill(newPassword);
  await page.screenshot({ path: `artifacts/lab-03/screenshots/user-management/reset-password/${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: /^confirm$/i }).click();
  // Wait for the edit panel to actually close (i.e. for the setUserPassword
  // request to resolve) before moving on — otherwise "Users" is already
  // visible underneath the open panel and the next step (logout) can race
  // ahead of the password actually being saved server-side.
  await expect(page.getByRole("heading", { name: /edit emma wilson/i })).toBeHidden();
  await expect(page.getByRole("heading", { name: /^users$/i })).toBeVisible();

  // Prove it: log in as Emma with the new password and confirm the forced-change screen appears.
  await page.getByRole("button", { name: /logout/i }).click();
  await page.getByLabel(/Email address/i).fill("emma.wilson@toktickit.local");
  await page.getByLabel(/^Password/i).fill(newPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /change your password/i })).toBeVisible();
});

test("an administrator cannot deactivate their own account", async ({ page }, testInfo) => {
  await loginAdmin(page);
  const row = page.locator("tr", { hasText: "Alex Thompson" });
  await row.getByRole("button", { name: /edit/i }).click();
  const checkbox = page.getByLabel(/^Active$/i);
  await expect(checkbox).toBeDisabled();
  await expect(page.getByText(/you cannot deactivate your own account/i)).toBeVisible();
  await page.screenshot({ path: `artifacts/lab-03/screenshots/user-management/self-deactivation-blocked/${testInfo.project.name}.png`, fullPage: true });
});

test("Direct API: an IT Staff session is blocked (403) from the Admin users endpoint", async ({ page, request }) => {
  await page.goto("/");
  await page.getByLabel(/Email address/i).fill(STAFF.email);
  await page.getByLabel(/^Password/i).fill(STAFF.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
  // The nav has no "Admin" link for IT Staff at all — forbidden at the UI level too.
  await expect(page.getByRole("button", { name: /^admin$/i })).not.toBeVisible();

  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const res = await request.get(`${API_BASE}/admin/users`, { headers: { Cookie: cookieHeader } });
  expect(res.status()).toBe(403);
});
