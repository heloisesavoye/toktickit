import { expect, type Page } from "@playwright/test";

export const STAFF = { email: "priya.nakamura@toktickit.local", password: "StaffDev123!", name: "Priya Nakamura" };
export const STAFF2 = { email: "chalermchai.suk@toktickit.local", password: "StaffDev123!", name: "Chalermchai Suk" };
export const ADMIN = { email: "admin@toktickit.local", password: "AdminDev123!" };
export const JENNIFER = { email: "jennifer.anderson@example.com", password: "RequesterDev123!" };
export const SARAH = { email: "sarah.johnson@example.com", password: "RequesterDev123!" };
export const API_BASE = "http://localhost:3000/api";

export async function login(page: Page, who: { email: string; password: string }) {
  await page.goto("/");
  await page.getByLabel(/Email address/i).fill(who.email);
  await page.getByLabel(/^Password/i).fill(who.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /^welcome/i })).toBeVisible();
}

export function nav(page: Page, name: RegExp) {
  return page.getByRole("navigation", { name: "Main" }).getByRole("button", { name });
}

export async function shot(page: Page, folder: string, project: string, name?: string) {
  const suffix = name ? `${name}-${project}` : project;
  await page.screenshot({ path: `artifacts/lab-04/screenshots/${folder}/${suffix}.png`, fullPage: true });
}

// RESP-01: no horizontal page scroll.
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

// Creates a fresh ticket as Sarah through the API so each run gets its own
// ticket (the dev DB is shared across runs and device projects).
export async function createTicketAs(page: Page, who: { email: string; password: string }, summary: string) {
  const ctx = page.context().request;
  const login = await ctx.post(`${API_BASE}/auth/login`, { data: who });
  expect(login.ok()).toBeTruthy();
  const cats = await (await ctx.get(`${API_BASE}/categories`)).json();
  const systems = await (await ctx.get(`${API_BASE}/related-systems`)).json();
  const res = await ctx.post(`${API_BASE}/tickets`, {
    data: {
      categoryId: cats.data[0].id,
      relatedSystemId: systems.data[0].id,
      summary,
      description: `${summary} — created by the Lab 4 E2E suite.`,
      requestedPriority: "HIGH",
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  await ctx.post(`${API_BASE}/auth/logout`);
  return body.data as { id: number; ticketNumber: string };
}
