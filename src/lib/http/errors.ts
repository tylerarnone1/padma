export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly expose = true,
    /**
     * True when the thrower already wrote an audit record for this outcome.
     * Route wrappers use it to avoid auditing the same denial twice, and it
     * keeps the audit next to the decision that made it rather than in a
     * caller that has to guess which stage failed.
     */
    readonly audited = false,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export function isAuditedError(error: unknown): boolean {
  return error instanceof ApplicationError && error.audited;
}

export class AuthenticationRequiredError extends ApplicationError {
  constructor() {
    super("Authentication is required.", 401, "authentication_required");
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(
    message = "You do not have permission to perform this action.",
    audited = false,
  ) {
    super(message, 403, "forbidden", true, audited);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource = "Resource", audited = false) {
    super(`${resource} was not found.`, 404, "not_found", true, audited);
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string, code = "conflict") {
    super(message, 409, code);
  }
}

export class ValidationError extends ApplicationError {
  constructor(
    message = "The request is invalid.",
    readonly issues?: Record<string, string[]>,
  ) {
    super(message, 422, "validation_failed");
  }
}

export class RateLimitedError extends ApplicationError {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many requests. Try again later.", 429, "rate_limited");
  }
}
