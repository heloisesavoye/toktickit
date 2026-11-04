import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  // Lab 4: every spec shares one persistent dev database (seeded accounts,
  // dashboard counts, the queue's first page). Running specs one at a time
  // keeps one test's writes from changing the counts another test is
  // comparing at the same moment.
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "tablet", use: { ...devices["iPad (gen 7)"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
});
