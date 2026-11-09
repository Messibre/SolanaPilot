import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedPage = pathname === "/profile" || pathname.startsWith("/profile/");
  const isProtectedApi = pathname.startsWith("/api/account");

  if (isProtectedPage || isProtectedApi) {
    // Auth.js session token cookie names for production (__Secure- prefix on HTTPS) and local dev
    const sessionToken =
      request.cookies.get("__Secure-authjs.session-token")?.value ||
      request.cookies.get("authjs.session-token")?.value ||
      request.cookies.get("__Secure-next-auth.session-token")?.value ||
      request.cookies.get("next-auth.session-token")?.value;

    if (!sessionToken) {
      if (isProtectedApi) {
        return NextResponse.json(
          { error: "Unauthorized. Please sign in to access this resource." },
          { status: 401 }
        );
      }

      // Redirect unauthenticated profile page visits to home page with notice
      const redirectUrl = new URL("/", request.url);
      redirectUrl.searchParams.set("auth_required", "true");
      return NextResponse.redirect(redirectUrl);
    }
  }

  const response = NextResponse.next();

  // Security headers enforcement
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none';");

  return response;
}

export const config = {
  matcher: [
    "/profile/:path*",
    "/profile",
    "/api/account/:path*",
  ],
};


