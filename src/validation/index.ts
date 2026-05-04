import { z } from 'zod';

/**
 * Wrapper around Zod parse that returns a typed result.
 * Throws ValidationError with field-level messages on failure.
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
    public readonly issues: z.ZodIssue[] = []
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validate<T>(schema: z.ZodSchema<T>, data: unknown, context = ''): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    const messages: string[] = [];

    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'unknown';
      fieldErrors[path] = issue.message;
      messages.push(`${path ? path + ': ' : ''}${issue.message}`);
    }

    const error = new ValidationError(
      messages.join('; '),
      fieldErrors,
      result.error.issues
    );

    if (context) {
      error.message = `[${context}] ${error.message}`;
    }

    throw error;
  }

  return result.data;
}

/**
 * Validate and unwrap in one step, returning null on validation failure.
 * Use when you want to handle errors gracefully in IPC handlers.
 */
export function validateOrNull<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context = ''
): T | null {
  try {
    return validate(schema, data, context);
  } catch {
    return null;
  }
}
