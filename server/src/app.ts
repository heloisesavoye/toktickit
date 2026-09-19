import express from "express";
import cors from "cors";
import categoriesRouter from "./routes/categories.js";
import relatedSystemsRouter from "./routes/relatedSystems.js";
import requestersRouter from "./routes/requesters.js";
import ticketsRouter from "./routes/tickets.js";
import attachmentsRouter from "./routes/attachments.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Kept compatible with the Lab 1 health check (server/tests/lab-01/health.test.ts).
  app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "TokTickIT API" }));

  app.use("/api/categories", categoriesRouter);
  app.use("/api/related-systems", relatedSystemsRouter);
  app.use("/api/requesters", requestersRouter);
  app.use("/api/tickets", ticketsRouter);
  app.use("/api", attachmentsRouter); // mounts /tickets/:id/attachments and /attachments/*

  app.use(errorHandler);

  return app;
}

// Compatibility export for server/tests/lab-01/health.test.ts, which imports
// a ready-made `app` instance rather than calling the Lab 2 factory.
export const app = createApp();
