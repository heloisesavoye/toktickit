import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

// BR-13: allowed types, max size, max active attachments.
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ACTIVE_ATTACHMENTS = 5;

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    // BR: safe filename/storage — never trust the original name for the on-disk path.
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      cb(new AppError(400, "UNSUPPORTED_FILE_TYPE") as unknown as null, false);
      return;
    }
    cb(null, true);
  },
});

const router = Router();

// POST /api/tickets/:ticketId/attachments — FR-12, BR-13, BR-14
router.post("/tickets/:ticketId/attachments", (req, res, next) => {
  upload.single("file")(req, res, async (err) => {
    try {
      if (err) {
        if ((err as any).code === "LIMIT_FILE_SIZE") throw new AppError(413, "FILE_TOO_LARGE");
        throw err instanceof AppError ? err : new AppError(400, "UPLOAD_ERROR");
      }

      const ticketId = Number(req.params.ticketId);
      const requesterId = Number(req.body.requesterId);

      const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, requesterId } });
      if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND");

      if (!req.file) throw new AppError(400, "VALIDATION_ERROR", { file: "required" });

      const activeCount = await prisma.attachment.count({
        where: { ticketId, isRemoved: false },
      });
      if (activeCount >= MAX_ACTIVE_ATTACHMENTS) {
        fs.unlinkSync(path.join(uploadDir, req.file.filename));
        throw new AppError(409, "ATTACHMENT_LIMIT_REACHED");
      }

      const attachment = await prisma.attachment.create({
        data: {
          ticketId,
          fileName: req.file.originalname,
          storedFileName: req.file.filename,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
        },
      });

      res.status(201).json({ data: attachment });
    } catch (e) {
      next(e);
    }
  });
});

// GET /api/attachments/:id — metadata, active or removed
router.get("/attachments/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const requesterId = Number(req.query.requesterId);
    const attachment = await prisma.attachment.findFirst({
      where: { id, ticket: { requesterId } },
    });
    if (!attachment) throw new AppError(404, "TICKET_NOT_FOUND");
    res.json({ data: attachment });
  } catch (err) {
    next(err);
  }
});

// GET /api/attachments/:id/download — BR-15: never serve a removed file
router.get("/attachments/:id/download", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const requesterId = Number(req.query.requesterId);
    const attachment = await prisma.attachment.findFirst({
      where: { id, ticket: { requesterId } },
    });
    if (!attachment) throw new AppError(404, "TICKET_NOT_FOUND");
    if (attachment.isRemoved) throw new AppError(410, "ATTACHMENT_REMOVED");

    res.download(path.join(uploadDir, attachment.storedFileName), attachment.fileName);
  } catch (err) {
    next(err);
  }
});

// POST /api/attachments/:id/remove — BR-15, BR-16, BR-17
router.post("/attachments/:id/remove", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { requesterId, removalReason } = req.body ?? {};

    if (typeof removalReason !== "string" || removalReason.trim().length < 5) {
      throw new AppError(400, "VALIDATION_ERROR", { removalReason: "Minimum 5 characters" });
    }

    const attachment = await prisma.attachment.findFirst({
      where: { id, ticket: { requesterId: Number(requesterId) } },
    });
    if (!attachment) throw new AppError(404, "TICKET_NOT_FOUND");
    if (attachment.isRemoved) throw new AppError(409, "ALREADY_REMOVED");

    const updated = await prisma.attachment.update({
      where: { id },
      data: {
        isRemoved: true,
        removedAt: new Date(),
        removedBy: Number(requesterId),
        removalReason: removalReason.trim(),
      },
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
