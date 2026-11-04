import { test, expect } from "@playwright/test";
import { STAFF, ADMIN, JENNIFER, API_BASE, login, nav, shot, expectNoHorizontalScroll } from "./helpers";

// E2E-04/E2E-05, RESP-01, STYLE-01, A11Y-01 + Parts 5, 8, 9 evidence.

test("IT Staff dashboard: cards drill down to a queue with the same count", async ({ page }, testInfo) => {
  const p = testInfo.project.name;
  await login(page, STAFF);
  await expect(page.getByRole("heading", { name: /welcome back, priya/i })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, "staff-dashboard", p);

  for (const label of ["Unassigned", "In Progress", "My Assigned"]) {
    await nav(page, /dashboard/i).click();
    const card = page.getByRole("button", { name: new RegExp(`^${label}: \\d+, view list$`) });
    const name = (await card.getAttribute("aria-label")) ?? "";
    const count = Number(/: (\d+),/.exec(name)![1]);
    await card.click();
    await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
    if (count === 0) {
      await expect(page.getByText(/no tickets match your filters/i)).toBeVisible();
    } else {
      await expect(page.getByText(new RegExp(`\\(${count} tickets\\)`))).toBeVisible();
    }
  }
  await shot(page, "staff-dashboard", p, "drill-down");
});

test("dashboard counts match the API and the database-backed queue", async ({ page }) => {
  const ctx = page.context().request;
  await ctx.post(`${API_BASE}/auth/login`, { data: STAFF });
  const dash = (await (await ctx.get(`${API_BASE}/dashboard/staff`)).json()).data;
  for (const metric of Object.values<any>(dash.metrics)) {
    const qs = new URLSearchParams({ ...metric.filter, pageSize: "50" });
    const list = await (await ctx.get(`${API_BASE}/staff/tickets?${qs}`)).json();
    expect(list.meta.totalItems).toBe(metric.count);
  }
  await ctx.post(`${API_BASE}/auth/logout`);
});

test("Administrator dashboard adds active-user counts", async ({ page }, testInfo) => {
  await login(page, ADMIN);
  await expect(page.getByRole("heading", { name: /active users/i })).toBeVisible();
  await shot(page, "staff-dashboard", testInfo.project.name, "admin");
});

test("Requester dashboard shows only own tickets and drills down to My Tickets", async ({ page }, testInfo) => {
  const p = testInfo.project.name;
  await login(page, JENNIFER);
  await expect(page.getByRole("heading", { name: /welcome, jennifer/i })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, "requester-dashboard", p);

  // Michael's seeded tickets must never appear on Jennifer's dashboard.
  await expect(page.getByText("TKT-2026-000003")).toHaveCount(0);
  await expect(page.getByText("TKT-2026-000004")).toHaveCount(0);

  const card = page.getByRole("button", { name: /^My Open Tickets: \d+, view list$/ });
  const count = Number(/: (\d+),/.exec((await card.getAttribute("aria-label")) ?? "")![1]);
  await card.click();
  await expect(page.getByRole("heading", { name: /^my tickets$/i })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(Math.min(count, 10));
  await shot(page, "requester-dashboard", p, "drill-down");
});

test("keyboard: Tab reaches a dashboard card with a visible focus ring and Enter opens it", async ({ page }, testInfo) => {
  await login(page, STAFF);
  const card = page.getByRole("button", { name: /^New: \d+, view list$/ });
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    if (await card.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(card).toBeFocused();
  const outline = await card.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
  await shot(page, "staff-dashboard", testInfo.project.name, "keyboard-focus");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
});
