import type { NextFunction, Request, Response } from "express";

// Central typed error used by every route so status/code/fields stay consistent
// with docs/lab-02/api-spec.md.
export class AppError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;

  constructor(status: number, code: string, fields?: Record<string, string>) {
    super(code);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, fields: err.fields } });
  }
  console.error(err);
  return res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
}
