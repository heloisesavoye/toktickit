import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.js";
import categoriesRouter from "./routes/categories.js";
import relatedSystemsRouter from "./routes/relatedSystems.js";
import ticketsRouter from "./routes/tickets.js";
import attachmentsRouter from "./routes/attachments.js";
import commentsNotesRouter from "./routes/commentsNotes.js";
import staffTicketsRouter from "./routes/staffTickets.js";
import adminUsersRouter from "./routes/adminUsers.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173", credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  // Kept compatible with the Lab 1 health check (server/tests/lab-01/health.test.ts).
  app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "TokTickIT API" }));

  // Lab 3: authentication replaces the Lab 2 Development Requester selector.
  app.use("/api/auth", authRouter);

  // Reference data — unchanged from Lab 2, still public (no ownership/role
  // concerns; only used to populate form dropdowns).
  app.use("/api/categories", categoriesRouter);
  app.use("/api/related-systems", relatedSystemsRouter);

  // Comments/notes are shared by Requester and IT Staff/Administrator, so
  // this must be mounted before ticketsRouter's blanket Requester-only gate
  // below, or /api/tickets/:id/comments would inherit that gate and reject
  // IT Staff/Administrator before ever reaching this router.
  app.use("/api", commentsNotesRouter); // /tickets/:id/comments, /tickets/:id/notes

  // Requester's own tickets/attachments — session-scoped (FR-09).
  app.use("/api/tickets", ticketsRouter);
  app.use("/api", attachmentsRouter); // /tickets/:id/attachments, /attachments/*

  // IT Staff Ticket Queue/Detail and Administrator User Management.
  app.use("/api/staff", staffTicketsRouter);
  app.use("/api/admin", adminUsersRouter);

  app.use(errorHandler);

  return app;
}

// Compatibility export for server/tests/lab-01/health.test.ts, which imports
// a ready-made `app` instance rather than calling the Lab 2/3 factory.
export const app = createApp();
