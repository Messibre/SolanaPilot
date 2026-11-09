import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

function createRequest(url: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(new URL(url, "http://localhost:3000"));
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

describe("Edge Middleware Route Guard", () => {
  it("redirects unauthenticated visits to /profile to home with auth_required query", async () => {
    const req = createRequest("/profile");
    const res = await middleware(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/?auth_required=true");
  });

  it("returns 401 JSON for unauthenticated requests to /api/account routes", async () => {
    const req = createRequest("/api/account/identities");
    const res = await middleware(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Unauthorized");
  });

  it("allows access to /profile when authjs.session-token cookie is present", async () => {
    const req = createRequest("/profile", {
      "authjs.session-token": "valid-token-sample",
    });
    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("allows access when production __Secure-authjs.session-token is present", async () => {
    const req = createRequest("/profile", {
      "__Secure-authjs.session-token": "secure-production-token",
    });
    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("allows access when legacy next-auth.session-token is present", async () => {
    const req = createRequest("/api/account/identities", {
      "next-auth.session-token": "legacy-session-token",
    });
    const res = await middleware(req);

    expect(res.status).toBe(200);
  });

  it("attaches strict security headers to responses", async () => {
    const req = createRequest("/programs");
    const res = await middleware(req);

    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
    expect(res.headers.get("Content-Security-Policy")).toBe("frame-ancestors 'none';");
  });
});
