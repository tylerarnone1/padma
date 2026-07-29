import { NextResponse, type NextRequest } from "next/server";
import { createContentSecurityPolicy } from "@/lib/http/content-security-policy";

export function proxy(request: NextRequest): NextResponse {
  const requestId = crypto.randomUUID();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = createContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development" ? "development" : "production",
  );
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-padma-request-host", request.nextUrl.hostname);
  requestHeaders.set("content-security-policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("content-security-policy", contentSecurityPolicy);
  response.headers.set("x-request-id", requestId);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
