import { Request, Response, NextFunction } from 'express';

/**
 * Sanitize request body to prevent XSS — strips HTML tags from string values.
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = stripHtml(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((v) =>
        typeof v === 'string'
          ? stripHtml(v)
          : typeof v === 'object' && v
            ? sanitizeObject(v as Record<string, unknown>)
            : v,
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}
