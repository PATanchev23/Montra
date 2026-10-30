/**
 * An expected failure with a stable, machine-readable code (e.g.
 * INVALID_CREDENTIALS). The errors plugin sends `code` and `message` as-is, so
 * messages must be safe to show to the user.
 */
export class AppError extends Error {
  /** Extra response headers, e.g. WWW-Authenticate on a 401. */
  readonly headers: Record<string, string>;
  /** Sent as `error.details`, e.g. which fields are missing. Must be safe to show. */
  readonly details: unknown;

  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    options: { headers?: Record<string, string>; details?: unknown } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.headers = options.headers ?? {};
    this.details = options.details;
  }
}
