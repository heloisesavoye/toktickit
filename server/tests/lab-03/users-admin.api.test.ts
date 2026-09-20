import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDatabase, seedFixtures, loginAgent, TEST_PASSWORD } from "./testUtils.js";

const app = createApp();

describe("Administrator user management", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // FR-20
  it("lists all users for an Administrator", async () => {
    const { adminA } = await seedFixtures();
    const agent = await loginAgent(app, adminA.email);
    const res = await agent.get("/api/admin/users");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("filters users by role", async () => {
    const { adminA } = await seedFixtures();
    const agent = await loginAgent(app, adminA.email);
    const res = await agent.get("/api/admin/users?role=IT_STAFF");
    expect(res.status).toBe(200);
    expect(res.body.data.every((u: any) => u.role === "IT_STAFF")).toBe(true);
  });

  // FR-21, BR-08: creating a user forces a password change on first login.
  it("creates a new user with requiresPasswordChange true", async () => {
    const { adminA } = await seedFixtures();
    const agent = await loginAgent(app, adminA.email);

    const res = await agent.post("/api/admin/users").send({
      name: "New Staffer",
      email: "new-staffer@example.com",
      role: "IT_STAFF",
      initialPassword: "Temp1234!",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.requiresPasswordChange).toBe(true);
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  // BR-11: unique email
  it("rejects creating a user with a duplicate email (409)", async () => {
    const { adminA, requesterA } = await seedFixtures();
    const agent = await loginAgent(app, adminA.email);

    const res = await agent.post("/api/admin/users").send({
      name: "Duplicate",
      email: requesterA.email,
      role: "REQUESTER",
      initialPassword: "Temp1234!",
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_IN_USE");
  });

  it("rejects a weak initial password", async () => {
    const { adminA } = await seedFixtures();
    const agent = await loginAgent(app, adminA.email);

    const res = await agent.post("/api/admin/users").send({
      name: "Weak Pw",
      email: "weak@example.com",
      role: "REQUESTER",
      initialPassword: "weak",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.initialPassword).toBeTruthy();
  });

  // FR-22: editing name/email/role/isActive
  it("updates a user's role", async () => {
    const { adminA, requesterA } = await seedFixtures();
    const agent = await loginAgent(app, adminA.email);

    const res = await agent.patch(`/api/admin/users/${requesterA.id}`).send({ role: "IT_STAFF" });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("IT_STAFF");
  });

  // BR-24: an Administrator can never deactivate their own account.
  it("rejects an Administrator deactivating their own account", async () => {
    const { adminA } = await seedFixtures();
    const agent = await loginAgent(app, adminA.email);

    const res = await agent.patch(`/api/admin/users/${adminA.id}`).send({ isActive: false });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SELF_DEACTIVATION");
  });

  // BR-24 (last admin): the system can never end up with zero active
  // Administrators. adminA is the only active admin in these fixtures
  // (inactiveAdmin is already inactive), so demoting adminA's own role away
  // from ADMINISTRATOR (a role change, not the self-deactivation path above)
  // must be blocked too.
  it("rejects demoting the last active Administrator's role, leaving zero admins", async () => {
    const { adminA } = await seedFixtures();
    const agent = await loginAgent(app, adminA.email);

    const res = await agent.patch(`/api/admin/users/${adminA.id}`).send({ role: "REQUESTER" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LAST_ADMIN");
  });

  // With a second active admin present, demoting one of them is fine.
  it("allows demoting an Administrator when another active Administrator remains", async () => {
    const { adminA, staffA } = await seedFixtures();
    const secondAdmin = await prisma.user.update({ where: { id: staffA.id }, data: { role: "ADMINISTRATOR" } });
    const agent = await loginAgent(app, adminA.email);

    const res = await agent.patch(`/api/admin/users/${secondAdmin.id}`).send({ role: "IT_STAFF" });
    expect(res.status).toBe(200);
  });

  it("rejects updating a nonexistent user (404)", async () => {
    const { adminA } = await seedFixtures();
    const agent = await loginAgent(app, adminA.email);
    const res = await agent.patch("/api/admin/users/999999").send({ name: "Ghost" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("USER_NOT_FOUND");
  });

  // FR-23, BR-26: admin-forced password reset invalidates existing sessions.
  it("forces a password reset and invalidates the target user's existing sessions", async () => {
    const { adminA, requesterA } = await seedFixtures();
    const targetAgent = await loginAgent(app, requesterA.email, TEST_PASSWORD);
    const adminAgent = await loginAgent(app, adminA.email);

    const reset = await adminAgent
      .post(`/api/admin/users/${requesterA.id}/password`)
      .send({ newInitialPassword: "ResetPass1!" });
    expect(reset.status).toBe(200);
    expect(reset.body.data.requiresPasswordChange).toBe(true);

    const staleSession = await targetAgent.get("/api/auth/me");
    expect(staleSession.status).toBe(401);
  });

  it("blocks a non-Administrator from admin user management (403)", async () => {
    const { staffA } = await seedFixtures();
    const agent = await loginAgent(app, staffA.email);
    const res = await agent.post("/api/admin/users").send({
      name: "Sneaky",
      email: "sneaky@example.com",
      role: "REQUESTER",
      initialPassword: "Temp1234!",
    });
    expect(res.status).toBe(403);
  });
});
