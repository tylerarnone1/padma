export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly expose = true,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class AuthenticationRequiredError extends ApplicationError {
  constructor() {
    super("Authentication is required.", 401, "authentication_required");
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message, 403, "forbidden");
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource = "Resource") {
    super(`${resource} was not found.`, 404, "not_found");
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
