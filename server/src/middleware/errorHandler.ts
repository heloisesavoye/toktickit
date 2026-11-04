import type { NextFunction, Request, Response } from "express";

// Central typed error used by every route so status/code/fields stay consistent
// with docs/lab-02/api-spec.md.
export class AppError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  publicMessage?: string;

  constructor(
    status: number,
    code: string,
    fields?: Record<string, string>,
    publicMessage?: string
  ) {
    super(code);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.publicMessage = publicMessage;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    // Lab 4 (BR-11): STALE_UPDATE also returns the current record so the
    // client can show it before the user retries.
    const current = (err as any).current;
    return res.status(err.status).json({
      error: { code: err.code, message: err.publicMessage, fields: err.fields },
      ...(current !== undefined ? { current } : {}),
    });
  }
  console.error(err);
  return res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
}
