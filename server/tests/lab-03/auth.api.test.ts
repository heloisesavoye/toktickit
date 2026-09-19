import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDatabase, seedFixtures, loginAgent, TEST_PASSWORD } from "./testUtils.js";

const app = createApp();

describe("Authentication", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // AUTH-01 / AC-14, FR-01
  it("logs in with valid credentials and sets a session cookie", async () => {
    const { requesterA } = await seedFixtures();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: requesterA.email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(requesterA.email);
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(res.headers["set-cookie"]?.[0]).toMatch(/toktickit_session=/);
  });

  // AUTH-02 / AC-15, BR-06: identical error for unknown email, wrong
  // password, and inactive account — never reveal which.
  it("rejects an unknown email with a generic 401", async () => {
    await seedFixtures();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: TEST_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects a wrong password with the same generic 401", async () => {
    const { requesterA } = await seedFixtures();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: requesterA.email, password: "WrongPassword1!" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  // AUTH-03 / AC-16, BR-10: a deactivated account cannot authenticate.
  it("rejects login for a deactivated account with the same generic 401", async () => {
    const { inactiveRequester } = await seedFixtures();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: inactiveRequester.email, password: TEST_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  // AUTH-04 / AC-17
  it("returns the current user from GET /api/auth/me when authenticated", async () => {
    const { requesterA } = await seedFixtures();
    const agent = await loginAgent(app, requesterA.email);
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(requesterA.email);
  });

  it("rejects GET /api/auth/me with no session (401)", async () => {
    await seedFixtures();
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  // AUTH-05 / AC-18, BR-09: logging out destroys the server-side session so
  // the same cookie can no longer be used.
  it("destroys the session on logout, so the cookie stops working", async () => {
    const { requesterA } = await seedFixtures();
    const agent = await loginAgent(app, requesterA.email);

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);

    const after = await agent.get("/api/auth/me");
    expect(after.status).toBe(401);
  });

  // AUTH-06 / AC-19, BR-02: a user who must change their password cannot
  // reach any other protected route until they do.
  it("blocks a password-change-pending user from other routes with 403", async () => {
    const { pendingChange } = await seedFixtures();
    const agent = await loginAgent(app, pendingChange.email);

    const res = await agent.get("/api/tickets");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    // /me and /change-password stay reachable so the client can show the form.
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
  });

  // AUTH-07 / AC-20, BR-08: new password must satisfy the policy.
  it("rejects a weak new password on change-password with 400", async () => {
    const { requesterA } = await seedFixtures();
    const agent = await loginAgent(app, requesterA.email);

    const res = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: TEST_PASSWORD, newPassword: "weak" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("WEAK_PASSWORD");
  });

  // AUTH-08 / AC-19: after a successful change, requiresPasswordChange
  // clears and the pending-change gate opens.
  it("clears requiresPasswordChange after a valid change-password and unblocks other routes", async () => {
    const { pendingChange } = await seedFixtures();
    const agent = await loginAgent(app, pendingChange.email);

    const change = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: TEST_PASSWORD, newPassword: "NewStrongPass1!" });
    expect(change.status).toBe(200);
    expect(change.body.data.requiresPasswordChange).toBe(false);

    const res = await agent.get("/api/tickets");
    expect(res.status).not.toBe(403);
  });

  it("rejects change-password when currentPassword is wrong", async () => {
    const { requesterA } = await seedFixtures();
    const agent = await loginAgent(app, requesterA.email);
    const res = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: "WrongOne1!", newPassword: "NewStrongPass1!" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});
