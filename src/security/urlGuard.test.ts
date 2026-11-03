import { describe, it, expect, vi } from "vitest";
import { assertSafeUrl, guardedFetch } from "./urlGuard";
import { NetworkBlockedError } from "../core/errors";

describe("urlGuard - assertSafeUrl", () => {
  it("allows safe public HTTPS URLs", async () => {
    const safeUrl = "https://api.devnet.solana.com/health";
    const resolver = vi.fn().mockResolvedValue(["93.184.216.34"]); // public IP
    const parsed = await assertSafeUrl(safeUrl, { dnsResolver: resolver });
    expect(parsed.href).toBe("https://api.devnet.solana.com/health");
  });

  it("blocks non-https protocols (http://, file://, ftp://, javascript:)", async () => {
    await expect(assertSafeUrl("http://example.com")).rejects.toThrow(NetworkBlockedError);
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toThrow(NetworkBlockedError);
    await expect(assertSafeUrl("ftp://example.com/file")).rejects.toThrow(NetworkBlockedError);
    await expect(assertSafeUrl("javascript:alert(1)")).rejects.toThrow(NetworkBlockedError);
  });

  it("blocks credentials in URLs (user:pass@host and user@host)", async () => {
    await expect(assertSafeUrl("https://user:pass@example.com/api")).rejects.toThrow(NetworkBlockedError);
    await expect(assertSafeUrl("https://user@example.com/api")).rejects.toThrow(NetworkBlockedError);
  });

  it("blocks cloud metadata address 169.254.169.254 and link-local range", async () => {
    await expect(assertSafeUrl("https://169.254.169.254/latest/meta-data")).rejects.toThrow(NetworkBlockedError);
    await expect(assertSafeUrl("https://169.254.1.1/info")).rejects.toThrow(NetworkBlockedError);
    // Even if allowLoopback is true, metadata must be blocked
    await expect(
      assertSafeUrl("http://169.254.169.254/metadata", { allowLoopback: true })
    ).rejects.toThrow(NetworkBlockedError);
  });

  it("blocks loopback IP variants when allowLoopback is false", async () => {
    const loopbacks = [
      "https://127.0.0.1",
      "https://127.1",
      "https://2130706433",
      "https://0x7f000001",
      "https://017700000001",
      "https://[::1]",
      "https://[::ffff:127.0.0.1]",
      "https://localhost",
    ];

    for (const url of loopbacks) {
      await expect(assertSafeUrl(url, { allowLoopback: false })).rejects.toThrow(NetworkBlockedError);
    }
  });

  it("allows loopback (including HTTP) when allowLoopback is true", async () => {
    const loopbacks = [
      "http://127.0.0.1:11434",
      "http://127.1:11434",
      "http://2130706433:11434",
      "http://0x7f000001:11434",
      "http://017700000001:11434",
      "http://[::1]:11434",
      "http://[::ffff:127.0.0.1]:11434",
      "http://localhost:11434",
    ];

    for (const url of loopbacks) {
      const parsed = await assertSafeUrl(url, { allowLoopback: true });
      expect(parsed).toBeDefined();
    }
  });

  it("blocks private network ranges even if allowLoopback is true", async () => {
    const privates = [
      "https://10.0.0.1",
      "https://172.16.0.1",
      "https://172.31.255.254",
      "https://192.168.1.1",
      "https://[fc00::1]",
      "https://[fe80::1]",
    ];

    for (const url of privates) {
      await expect(assertSafeUrl(url, { allowLoopback: true })).rejects.toThrow(NetworkBlockedError);
    }
  });

  it("blocks hostnames that resolve to private or loopback IPs via DNS", async () => {
    const privateResolver = vi.fn().mockResolvedValue(["10.200.0.1"]);
    await expect(
      assertSafeUrl("https://internal.corp/secret", { dnsResolver: privateResolver })
    ).rejects.toThrow(NetworkBlockedError);

    const loopbackResolver = vi.fn().mockResolvedValue(["127.0.0.1"]);
    await expect(
      assertSafeUrl("https://evil-spoof.com", { dnsResolver: loopbackResolver })
    ).rejects.toThrow(NetworkBlockedError);
  });

  it("enforces allowedHosts allowlist if provided", async () => {
    const resolver = vi.fn().mockResolvedValue(["93.184.216.34"]);
    await expect(
      assertSafeUrl("https://api.other.com/v1", {
        allowedHosts: ["api.allowed.com"],
        dnsResolver: resolver,
      })
    ).rejects.toThrow(NetworkBlockedError);

    const allowed = await assertSafeUrl("https://api.allowed.com/v1", {
      allowedHosts: ["api.allowed.com"],
      dnsResolver: resolver,
    });
    expect(allowed.hostname).toBe("api.allowed.com");
  });
});

describe("urlGuard - guardedFetch", () => {
  it("fetches safe URL successfully without redirects", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
    const resolver = vi.fn().mockResolvedValue(["93.184.216.34"]);

    const res = await guardedFetch("https://api.safe.com/data", undefined, {
      fetchFn: mockFetch,
      dnsResolver: resolver,
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  it("follows valid safe redirects up to max 3 hops", async () => {
    const resolver = vi.fn().mockResolvedValue(["93.184.216.34"]);
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { Location: "https://api.safe.com/v2" },
        })
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: "/v3" },
        })
      )
      .mockResolvedValueOnce(new Response("Done", { status: 200 }));

    const res = await guardedFetch("https://api.safe.com/v1", undefined, {
      fetchFn: mockFetch,
      dnsResolver: resolver,
    });
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("blocks a redirect that targets a private IP (SSRF redirect attack)", async () => {
    const resolver = vi.fn().mockImplementation(async (host: string) => {
      if (host === "api.safe.com") return ["93.184.216.34"];
      if (host === "internal.service") return ["192.168.1.100"];
      return ["127.0.0.1"];
    });

    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { Location: "https://internal.service/leak" },
      })
    );

    await expect(
      guardedFetch("https://api.safe.com/v1", undefined, {
        fetchFn: mockFetch,
        dnsResolver: resolver,
      })
    ).rejects.toThrow(NetworkBlockedError);
  });

  it("blocks when redirect count exceeds max 3 hops", async () => {
    const resolver = vi.fn().mockResolvedValue(["93.184.216.34"]);
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "https://api.safe.com/next" },
      })
    );

    await expect(
      guardedFetch("https://api.safe.com/start", undefined, {
        fetchFn: mockFetch,
        dnsResolver: resolver,
      })
    ).rejects.toThrow(NetworkBlockedError);
  });
});
