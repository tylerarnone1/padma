import { NextResponse } from "next/server";
import { isDevelopmentAuthRequestEnabled } from "@/lib/auth/auth-mode";
import {
  createDevelopmentSessionToken,
  DEVELOPMENT_SESSION_COOKIE,
} from "@/lib/auth/development-session-cookie";
import { getDevelopmentSession } from "@/lib/auth/development-session";
import { getAuthSecret, getServerEnvironment } from "@/lib/env/server";
import { NotFoundError } from "@/lib/http/errors";
import { problemResponse } from "@/lib/http/problem";
import {
  assertWithinRateLimit,
  rateLimitKey,
  rateLimitSubject,
} from "@/lib/http/rate-limit";
import { assertSameOrigin } from "@/lib/http/request";
import {
  getRequestId,
  runWithRequestContext,
} from "@/lib/logging/request-context";

const DEVELOPMENT_SESSION_SECONDS = 8 * 60 * 60;

function requireDevelopmentAuth(request: Request): void {
  if (
    !isDevelopmentAuthRequestEnabled(
      getServerEnvironment(),
      new URL(request.url).hostname,
    )
  ) {
    throw new NotFoundError("Development authentication");
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = getRequestId(request.headers);

  return runWithRequestContext({ requestId }, async () => {
    try {
      const requestOrigin = assertSameOrigin(request);
      requireDevelopmentAuth(request);
      // This handler lives under /api/auth/ but is not part of the Better Auth
      // handler, so Better Auth's rate limiting does not reach it.
      await assertWithinRateLimit({
        key: rateLimitKey(
          "development-session",
          rateLimitSubject({ request }),
        ),
        limit: 20,
        windowSeconds: 60,
      });
      await getDevelopmentSession();

      const response = NextResponse.redirect(
        new URL("/dashboard", requestOrigin),
        303,
      );
      response.cookies.set({
        name: DEVELOPMENT_SESSION_COOKIE,
        value: createDevelopmentSessionToken(getAuthSecret()),
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: DEVELOPMENT_SESSION_SECONDS,
        priority: "high",
      });
      response.headers.set("cache-control", "no-store");
      response.headers.set("x-request-id", requestId);
      return response;
    } catch (error) {
      return problemResponse(error, request, requestId);
    }
  });
}

export async function DELETE(request: Request): Promise<Response> {
  const requestId = getRequestId(request.headers);

  return runWithRequestContext({ requestId }, async () => {
    try {
      assertSameOrigin(request);
      requireDevelopmentAuth(request);

      const response = new NextResponse(null, {
        status: 204,
        headers: {
          "cache-control": "no-store",
          "x-request-id": requestId,
        },
      });
      response.cookies.set({
        name: DEVELOPMENT_SESSION_COOKIE,
        value: "",
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 0,
        priority: "high",
      });
      return response;
    } catch (error) {
      return problemResponse(error, request, requestId);
    }
  });
}
