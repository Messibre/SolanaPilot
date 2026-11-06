import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedPage = pathname === "/profile" || pathname.startsWith("/profile/");
  const isProtectedApi = pathname.startsWith("/api/account");

  if (isProtectedPage || isProtectedApi) {
    const session = await auth();

    if (!session?.user?.id) {
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

