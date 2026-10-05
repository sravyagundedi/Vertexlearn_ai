import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('[Error caught by middleware]:', err);

  // Handle Zod validation errors
  if (err instanceof ZodError || err?.name === 'ZodError') {
    const firstIssue = err.issues?.[0];
    const message = firstIssue
      ? `${firstIssue.path.join('.') || 'Input'}: ${firstIssue.message}`
      : 'Validation failed. Please check your submitted inputs.';
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message,
        details: err.issues,
      },
    });
  }

  // Handle Postgres Unique Constraint Violation
  if (err.code === '23505') {
    const detail = err.detail || '';
    let message = 'A record with this information already exists.';
    if (detail.includes('email')) {
      message = 'An account with this email address already exists.';
    } else if (detail.includes('title')) {
      message = 'A course with this title already exists.';
    }
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message,
      },
    });
  }

  // Handle Postgres Foreign Key Violation
  if (err.code === '23503') {
    return res.status(400).json({
      error: {
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'Referenced entity does not exist.',
      },
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Invalid or expired session. Please sign in again.',
      },
    });
  }

  // Handle explicit status or fallback
  const status = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  const code = err.code || (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  const message = err.message || 'An unexpected server error occurred. Please try again.';

  return res.status(status).json({
    error: {
      code,
      message,
    },
  });
}
