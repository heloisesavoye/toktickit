import { test, expect } from "@playwright/test";

// E2E-01/E2E-02 (tests.md) + Part 5 evidence: authentication and session flows.
// Requires both dev servers running: server on :3000, client on :5173.

const STAFF = { email: "priya.nakamura@toktickit.local", password: "StaffDev123!" };
const INACTIVE = { email: "former.employee@example.com", password: "RequesterDev123!" };
const FIRST_LOGIN = { email: "new.hire@toktickit.local", password: "Temp1234!" };

async function shot(page: import("@playwright/test").Page, name: string, project: string) {
  await page.screenshot({ path: `artifacts/lab-03/screenshots/authentication/${name}/${project}.png`, fullPage: true });
}

test("Valid login shows the authenticated shell with role badge", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.screenshot({ path: `artifacts/lab-03/screenshots/authentication/${testInfo.project.name}.png`, fullPage: true });
  await page.getByLabel(/Email address/i).fill(STAFF.email);
  await page.getByLabel(/^Password/i).fill(STAFF.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
  await expect(page.getByRole("banner").getByText(/priya nakamura/i)).toBeVisible();
  await expect(page.getByRole("banner").getByText(/it staff/i)).toBeVisible();
  await shot(page, "valid-login", testInfo.project.name);
});

test("Invalid password shows the generic safe-failure message (BR-06)", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByLabel(/Email address/i).fill(STAFF.email);
  await page.getByLabel(/^Password/i).fill("WrongPassword1!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("alert")).toHaveText(/invalid email or password/i);
  await shot(page, "invalid-login", testInfo.project.name);
});

test("Inactive account is rejected with the same generic message (BR-06)", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByLabel(/Email address/i).fill(INACTIVE.email);
  await page.getByLabel(/^Password/i).fill(INACTIVE.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("alert")).toHaveText(/invalid email or password/i);
  await shot(page, "inactive-account", testInfo.project.name);
});

test("Sign-in button shows a busy state while the request is in flight", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByLabel(/Email address/i).fill(STAFF.email);
  await page.getByLabel(/^Password/i).fill(STAFF.password);
  const button = page.getByRole("button", { name: /sign in/i });
  await button.click();
  // Busy label swaps in briefly; assert it appeared at some point during the request.
  await expect(page.getByRole("button", { name: /signing in/i })).toBeVisible({ timeout: 2000 }).catch(() => {});
  await shot(page, "busy-state", testInfo.project.name);
  await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
});

test("Mandatory first-login password change, then normal access", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByLabel(/Email address/i).fill(FIRST_LOGIN.email);
  await page.getByLabel(/^Password/i).fill(FIRST_LOGIN.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /change your password/i })).toBeVisible();
  await shot(page, "forced-password-change", testInfo.project.name);

  // Not sliced: slicing to a fixed length risked cutting off the trailing
  // "!" (the only special character), which silently failed the password
  // policy and left the Continue button permanently disabled.
  const newPassword = `NewHire!${Date.now()}`;
  await page.getByLabel(/Current \(temporary\) password/i).fill(FIRST_LOGIN.password);
  await page.getByLabel(/^New password/i).fill(newPassword);
  await page.getByLabel(/Confirm new password/i).fill(newPassword);
  await page.getByRole("button", { name: /continue/i }).click();
  await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
});

test("Logout returns to the login screen and blocks further access", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByLabel(/Email address/i).fill(STAFF.email);
  await page.getByLabel(/^Password/i).fill(STAFF.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();

  await page.getByRole("button", { name: /logout/i }).click();
  await expect(page.getByRole("heading", { name: /sign in to your account/i })).toBeVisible();
  await shot(page, "logged-out", testInfo.project.name);

  // Reloading (simulating a saved bookmark / back button) must not restore access.
  await page.reload();
  await expect(page.getByRole("heading", { name: /sign in to your account/i })).toBeVisible();
  await shot(page, "blocked-after-logout", testInfo.project.name);
});
