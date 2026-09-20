import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDatabase, seedFixtures, loginAgent } from "./testUtils.js";
import { generateTicketNumber } from "../../src/lib/ticketNumber.js";

const app = createApp();

async function createTicket(requesterId: number, categoryId: number, relatedSystemId: number) {
  return prisma.ticket.create({
    data: {
      ticketNumber: await generateTicketNumber(prisma),
      requesterId,
      categoryId,
      relatedSystemId,
      summary: "Sample ticket summary",
      description: "Sample ticket description text.",
      requestedPriority: "MEDIUM",
    },
  });
}

describe("Attachments", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // API-10 / AC-06 (Lab 3: identity from the authenticated session)
  it("rejects a file over 5MB with 413", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, requesterA.email);
    const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 1);

    const res = await agent
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach("file", bigBuffer, { filename: "big.png", contentType: "image/png" });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("FILE_TOO_LARGE");
  });

  // API-12 / BR-13
  it("rejects an unsupported file type with 400", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, requesterA.email);

    const res = await agent
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach("file", Buffer.from("not-an-image"), {
        filename: "malware.exe",
        contentType: "application/octet-stream",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  // API-11 / AC-07
  it("rejects a 6th attachment once 5 are active", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, requesterA.email);

    for (let i = 0; i < 5; i++) {
      const res = await agent
        .post(`/api/tickets/${ticket.id}/attachments`)
        .attach("file", Buffer.from(`file-${i}`), {
          filename: `file-${i}.png`,
          contentType: "image/png",
        });
      expect(res.status).toBe(201);
    }

    const sixth = await agent
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach("file", Buffer.from("file-6"), { filename: "file-6.png", contentType: "image/png" });

    expect(sixth.status).toBe(409);
    expect(sixth.body.error.code).toBe("ATTACHMENT_LIMIT_REACHED");
  });

  // API-14 / AC-12 and API-15 / AC-13
  it("blocks download after soft removal but keeps metadata", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, requesterA.email);

    const upload = await agent
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach("file", Buffer.from("content"), { filename: "evidence.png", contentType: "image/png" });
    const attachmentId = upload.body.data.id;

    const remove = await agent
      .post(`/api/attachments/${attachmentId}/remove`)
      .send({ removalReason: "Uploaded the wrong file" });
    expect(remove.status).toBe(200);
    expect(remove.body.data.isRemoved).toBe(true);

    const download = await agent.get(`/api/attachments/${attachmentId}/download`);
    expect(download.status).toBe(410);

    const metadata = await agent.get(`/api/attachments/${attachmentId}`);
    expect(metadata.status).toBe(200);
    expect(metadata.body.data.fileName).toBe("evidence.png");
  });

  // API-16 / BR-16
  it("requires a removal reason of at least 5 characters", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, requesterA.email);
    const upload = await agent
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach("file", Buffer.from("content"), { filename: "evidence.png", contentType: "image/png" });

    const res = await agent
      .post(`/api/attachments/${upload.body.data.id}/remove`)
      .send({ removalReason: "no" });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.removalReason).toBeTruthy();
  });

  // API-05 / AC-03: ownership isolation — another requester's session cannot
  // upload to, read, or remove an attachment on a ticket they don't own, even
  // though the old spoofable `requesterId` field is gone from the request.
  it("does not let another requester upload to, read, or remove a ticket's attachments", async () => {
    const { requesterA, requesterB, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const ownerAgent = await loginAgent(app, requesterA.email);
    const intruderAgent = await loginAgent(app, requesterB.email);

    const uploadAsIntruder = await intruderAgent
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach("file", Buffer.from("content"), { filename: "evidence.png", contentType: "image/png" });
    expect(uploadAsIntruder.status).toBe(404);
    expect(uploadAsIntruder.body.error.code).toBe("TICKET_NOT_FOUND");

    const upload = await ownerAgent
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach("file", Buffer.from("content"), { filename: "evidence.png", contentType: "image/png" });
    const attachmentId = upload.body.data.id;

    const readAsIntruder = await intruderAgent.get(`/api/attachments/${attachmentId}`);
    expect(readAsIntruder.status).toBe(404);

    const removeAsIntruder = await intruderAgent
      .post(`/api/attachments/${attachmentId}/remove`)
      .send({ removalReason: "Not mine to remove" });
    expect(removeAsIntruder.status).toBe(404);
  });

  it("requires authentication (401)", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach("file", Buffer.from("content"), { filename: "evidence.png", contentType: "image/png" });

    expect(res.status).toBe(401);
  });
});
