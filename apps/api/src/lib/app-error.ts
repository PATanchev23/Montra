/**
 * An expected failure with a stable, machine-readable code (e.g.
 * INVALID_CREDENTIALS). The errors plugin sends `code` and `message` as-is, so
 * messages must be safe to show to the user.
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    /** Extra response headers, e.g. WWW-Authenticate on a 401. */
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'AppError';
  }
}
