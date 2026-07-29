import { ZodError, z } from "zod";
import { ApplicationError, ValidationError } from "@/lib/http/errors";
import { logger } from "@/lib/logging/logger";

type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code: string;
  requestId: string;
  errors?: Record<string, string[]>;
};

function titleForStatus(status: number): string {
  const titles: Record<number, string> = {
    400: "Bad Request",
    401: "Authentication Required",
    403: "Permission Denied",
    404: "Not Found",
    409: "Conflict",
    422: "Validation Failed",
    429: "Too Many Requests",
    500: "Internal Server Error",
  };
  return titles[status] ?? "Request Failed";
}

function zodIssues(error: ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

export function problemResponse(
  error: unknown,
  request: Request,
  requestId: string,
): Response {
  let applicationError: ApplicationError;

  if (error instanceof ZodError) {
    applicationError = new ValidationError(
      "One or more request fields are invalid.",
      zodIssues(error),
    );
  } else if (error instanceof ApplicationError) {
    applicationError = error;
  } else if (error instanceof SyntaxError) {
    applicationError = new ApplicationError(
      "The request body is not valid JSON.",
      400,
      "invalid_json",
    );
  } else {
    applicationError = new ApplicationError(
      "An unexpected error occurred.",
      500,
      "internal_error",
      false,
    );
  }

  if (applicationError.status >= 500) {
    logger.error(
      { error, requestId, method: request.method, path: new URL(request.url).pathname },
      "Request failed unexpectedly",
    );
  } else {
    logger.warn(
      {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        status: applicationError.status,
        code: applicationError.code,
      },
      "Request rejected",
    );
  }

  const body: ProblemDetails = {
    type: `https://padma.dev/problems/${applicationError.code}`,
    title: titleForStatus(applicationError.status),
    status: applicationError.status,
    detail: applicationError.expose
      ? applicationError.message
      : "An unexpected error occurred.",
    instance: new URL(request.url).pathname,
    code: applicationError.code,
    requestId,
  };

  if (
    applicationError instanceof ValidationError &&
    applicationError.issues
  ) {
    body.errors = applicationError.issues;
  }

  return Response.json(body, {
    status: applicationError.status,
    headers: {
      "content-type": "application/problem+json",
      "cache-control": "no-store",
      "x-request-id": requestId,
    },
  });
}
