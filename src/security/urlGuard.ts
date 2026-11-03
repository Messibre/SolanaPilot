/**
 * URL guard and guarded fetch to protect against Server-Side Request Forgery (SSRF).
 * Strictly adheres to Agent.md §10.
 * Zero vscode imports allowed.
 */

import { lookup } from "node:dns/promises";
import { NetworkBlockedError } from "../core/errors";

export type DnsResolver = (hostname: string) => Promise<string[]>;

export interface AssertSafeUrlOptions {
  allowedHosts?: string[] | Set<string>;
  allowLoopback?: boolean;
  dnsResolver?: DnsResolver;
}

export interface GuardedFetchOptions extends AssertSafeUrlOptions {
  maxRedirects?: number;
  fetchFn?: typeof fetch;
}

interface IpEvaluation {
  isLoopback: boolean;
  isBlocked: boolean;
  reason?: string;
}

/**
 * Parses numeric IPv4 representations (dotted-quad, hex, octal, decimal).
 * Returns unsigned 32-bit integer or null if invalid.
 */
function parseIpv4ToUint32(input: string): number | null {
  const trimmed = input.trim();
  const parts = trimmed.split(".");
  if (parts.length > 4 || parts.length === 0) return null;

  const parsedParts: number[] = [];
  for (const p of parts) {
    if (!p) return null;
    let val: number;
    if (p.startsWith("0x") || p.startsWith("0X")) {
      val = parseInt(p, 16);
    } else if (p.length > 1 && p.startsWith("0") && /^[0-7]+$/.test(p)) {
      val = parseInt(p, 8);
    } else if (/^\d+$/.test(p)) {
      val = parseInt(p, 10);
    } else {
      return null;
    }
    if (isNaN(val) || val < 0) return null;
    parsedParts.push(val);
  }

  let num = 0;
  if (parsedParts.length === 1) {
    num = parsedParts[0];
  } else if (parsedParts.length === 2) {
    if (parsedParts[0] > 255 || parsedParts[1] > 0xffffff) return null;
    num = (parsedParts[0] << 24) | parsedParts[1];
  } else if (parsedParts.length === 3) {
    if (parsedParts[0] > 255 || parsedParts[1] > 255 || parsedParts[2] > 0xffff) return null;
    num = (parsedParts[0] << 24) | (parsedParts[1] << 16) | parsedParts[2];
  } else if (parsedParts.length === 4) {
    if (parsedParts.some((p) => p > 255)) return null;
    num = (parsedParts[0] << 24) | (parsedParts[1] << 16) | (parsedParts[2] << 8) | parsedParts[3];
  }

  return num >>> 0;
}

/**
 * Evaluates whether an IPv4 uint32 is in a blocked or loopback range.
 */
function evaluateIpv4(num: number, allowLoopback: boolean): IpEvaluation {
  const byte1 = (num >>> 24) & 0xff;
  const byte2 = (num >>> 16) & 0xff;
  const byte3 = (num >>> 8) & 0xff;

  // 127.0.0.0/8: Loopback
  if (byte1 === 127) {
    if (allowLoopback) {
      return { isLoopback: true, isBlocked: false };
    }
    return { isLoopback: true, isBlocked: true, reason: "IPv4 loopback address is blocked" };
  }

  // 169.254.0.0/16: Link-local & cloud metadata (169.254.169.254)
  if (byte1 === 169 && byte2 === 254) {
    return { isLoopback: false, isBlocked: true, reason: "Link-local / cloud metadata address is blocked" };
  }

  // 0.0.0.0/8: Unspecified / broadcast / loopback-alias
  if (byte1 === 0) {
    return { isLoopback: false, isBlocked: true, reason: "Unspecified 0.0.0.0/8 address is blocked" };
  }

  // 10.0.0.0/8: Private
  if (byte1 === 10) {
    return { isLoopback: false, isBlocked: true, reason: "Private 10.0.0.0/8 address is blocked" };
  }

  // 100.64.0.0/10: Carrier-Grade NAT
  if (byte1 === 100 && (byte2 & 0xc0) === 64) {
    return { isLoopback: false, isBlocked: true, reason: "Carrier-Grade NAT address is blocked" };
  }

  // 172.16.0.0/12: Private (172.16.0.0 - 172.31.255.255)
  if (byte1 === 172 && (byte2 & 0xf0) === 16) {
    return { isLoopback: false, isBlocked: true, reason: "Private 172.16.0.0/12 address is blocked" };
  }

  // 192.0.0.0/24: IETF Protocol
  if (byte1 === 192 && byte2 === 0 && byte3 === 0) {
    return { isLoopback: false, isBlocked: true, reason: "IETF protocol reserved address is blocked" };
  }

  // 192.168.0.0/16: Private
  if (byte1 === 192 && byte2 === 168) {
    return { isLoopback: false, isBlocked: true, reason: "Private 192.168.0.0/16 address is blocked" };
  }

  // 198.18.0.0/15: Benchmark
  if (byte1 === 198 && (byte2 & 0xfe) === 18) {
    return { isLoopback: false, isBlocked: true, reason: "Benchmark reserved address is blocked" };
  }

  // Multicast / Reserved: 224.0.0.0/4 and above
  if (byte1 >= 224) {
    return { isLoopback: false, isBlocked: true, reason: "Multicast or reserved address is blocked" };
  }

  return { isLoopback: false, isBlocked: false };
}

/**
 * Evaluates an IP string (IPv4, IPv6, or IPv4-mapped IPv6).
 */
function evaluateIp(ipRaw: string, allowLoopback: boolean): IpEvaluation {
  let ip = ipRaw.trim();
  if (ip.startsWith("[") && ip.endsWith("]")) {
    ip = ip.slice(1, -1);
  }

  // Check IPv4-mapped IPv6: ::ffff:a.b.c.d or ::ffff:XXXX:XXXX
  const mappedMatch = /^::ffff:(.+)$/i.exec(ip);
  if (mappedMatch) {
    const rest = mappedMatch[1];
    if (rest.includes(".")) {
      const ipv4Num = parseIpv4ToUint32(rest);
      if (ipv4Num !== null) {
        return evaluateIpv4(ipv4Num, allowLoopback);
      }
    } else if (rest.includes(":")) {
      const hexParts = rest.split(":");
      if (hexParts.length === 2) {
        const h1 = parseInt(hexParts[0], 16);
        const h2 = parseInt(hexParts[1], 16);
        if (!isNaN(h1) && !isNaN(h2)) {
          const num = (((h1 >> 8) & 0xff) << 24) | ((h1 & 0xff) << 16) | (((h2 >> 8) & 0xff) << 8) | (h2 & 0xff);
          return evaluateIpv4(num >>> 0, allowLoopback);
        }
      }
    }
  }

  // IPv6 checks
  const lowerIp = ip.toLowerCase();
  if (lowerIp === "::1" || lowerIp === "0:0:0:0:0:0:0:1") {
    if (allowLoopback) {
      return { isLoopback: true, isBlocked: false };
    }
    return { isLoopback: true, isBlocked: true, reason: "IPv6 loopback address is blocked" };
  }

  if (lowerIp === "::" || lowerIp === "0:0:0:0:0:0:0:0") {
    return { isLoopback: false, isBlocked: true, reason: "IPv6 unspecified address is blocked" };
  }

  // IPv6 Unique Local Address (ULA): fc00::/7 (starts with fc or fd)
  if (lowerIp.startsWith("fc") || lowerIp.startsWith("fd")) {
    return { isLoopback: false, isBlocked: true, reason: "IPv6 unique local address is blocked" };
  }

  // IPv6 Link-Local: fe80::/10 (starts with fe8, fe9, fea, feb)
  if (/^fe[89ab]/i.test(lowerIp)) {
    return { isLoopback: false, isBlocked: true, reason: "IPv6 link-local address is blocked" };
  }

  // Try IPv4 parsing
  const ipv4Num = parseIpv4ToUint32(ip);
  if (ipv4Num !== null) {
    return evaluateIpv4(ipv4Num, allowLoopback);
  }

  // Not an IP literal or public IPv6
  return { isLoopback: false, isBlocked: false };
}

const defaultResolver: DnsResolver = async (host: string): Promise<string[]> => {
  try {
    const results = await lookup(host, { all: true });
    return results.map((r) => r.address);
  } catch {
    throw new NetworkBlockedError(`DNS resolution failed for host: ${host}`);
  }
};

/**
 * Validates that a target URL is safe to fetch according to SSRF policies.
 * Throws NetworkBlockedError if the URL violates security rules.
 */
export async function assertSafeUrl(
  inputUrl: string | URL,
  options?: AssertSafeUrlOptions
): Promise<URL> {
  let url: URL;
  try {
    url = typeof inputUrl === "string" ? new URL(inputUrl) : new URL(inputUrl.toString());
  } catch (err) {
    throw new NetworkBlockedError("Malformed or invalid URL", err);
  }

  // Credentials in URL forbidden
  if (url.username || url.password) {
    throw new NetworkBlockedError("URLs with embedded credentials are not allowed");
  }

  const allowLoopback = options?.allowLoopback ?? false;
  const protocol = url.protocol.toLowerCase();

  if (protocol === "http:") {
    if (!allowLoopback) {
      throw new NetworkBlockedError("HTTP protocol is only allowed for loopback connections with allowLoopback: true");
    }
  } else if (protocol !== "https:") {
    throw new NetworkBlockedError(`Protocol '${url.protocol}' is forbidden; only HTTPS is permitted`);
  }

  // Check allowedHosts if specified
  if (options?.allowedHosts) {
    const allowed = Array.isArray(options.allowedHosts)
      ? new Set(options.allowedHosts.map((h) => h.toLowerCase()))
      : options.allowedHosts;
    if (!allowed.has(url.hostname.toLowerCase())) {
      throw new NetworkBlockedError(`Host '${url.hostname}' is not in the allowed hosts list`);
    }
  }

  const lowerHost = url.hostname.toLowerCase();

  // Cloud metadata hostnames
  if (
    lowerHost === "169.254.169.254" ||
    lowerHost === "metadata.google.internal" ||
    lowerHost === "instance-data" ||
    lowerHost.endsWith(".internal")
  ) {
    throw new NetworkBlockedError(`Access to cloud metadata service '${lowerHost}' is blocked`);
  }

  // Localhost hostname check
  if (lowerHost === "localhost" || lowerHost.endsWith(".localhost")) {
    if (!allowLoopback) {
      throw new NetworkBlockedError("Loopback hostname 'localhost' is blocked");
    }
    return url;
  }

  // Direct IP evaluation on hostname
  const directEvaluation = evaluateIp(url.hostname, allowLoopback);
  if (directEvaluation.isBlocked) {
    throw new NetworkBlockedError(directEvaluation.reason ?? "Target IP address is blocked by security policy");
  }

  if (directEvaluation.isLoopback) {
    return url;
  }

  // If protocol was http: and hostname was not a verified loopback IP, reject
  if (protocol === "http:" && !directEvaluation.isLoopback) {
    // If it's a domain name, DNS resolution will verify if it resolves to loopback
  }

  // Check if hostname is an IP literal (IPv4 or IPv6)
  const isIpv4Literal = parseIpv4ToUint32(url.hostname) !== null;
  const isIpv6Literal = url.hostname.includes(":");

  if (isIpv4Literal || isIpv6Literal) {
    // Hostname was an IP literal and passed direct evaluation
    if (protocol === "http:" && !directEvaluation.isLoopback) {
      throw new NetworkBlockedError("HTTP protocol is only permitted for loopback connections");
    }
    return url;
  }

  // Domain name: resolve via DNS and inspect all returned IPs
  const resolver = options?.dnsResolver ?? defaultResolver;
  const resolvedIps = await resolver(url.hostname);

  if (!resolvedIps || resolvedIps.length === 0) {
    throw new NetworkBlockedError(`Could not resolve any IP addresses for host '${url.hostname}'`);
  }

  let allLoopback = true;
  for (const resolvedIp of resolvedIps) {
    const evalResult = evaluateIp(resolvedIp, allowLoopback);
    if (evalResult.isBlocked) {
      throw new NetworkBlockedError(
        evalResult.reason ?? `Resolved IP '${resolvedIp}' is blocked by security policy`
      );
    }
    if (!evalResult.isLoopback) {
      allLoopback = false;
    }
  }

  if (protocol === "http:" && !allLoopback) {
    throw new NetworkBlockedError("HTTP protocol is only permitted for loopback connections");
  }

  return url;
}

/**
 * Fetch wrapper that guards outbound requests and re-validates each redirect hop.
 */
export async function guardedFetch(
  input: string | URL | Request,
  init?: RequestInit,
  options?: GuardedFetchOptions
): Promise<Response> {
  const maxRedirects = options?.maxRedirects ?? 3;
  const fetchImpl = options?.fetchFn ?? fetch;

  let currentUrl: URL;
  if (typeof input === "string") {
    currentUrl = await assertSafeUrl(input, options);
  } else if (input instanceof URL) {
    currentUrl = await assertSafeUrl(input, options);
  } else if ("url" in input) {
    currentUrl = await assertSafeUrl(input.url, options);
  } else {
    throw new NetworkBlockedError("Invalid fetch input");
  }

  let hopCount = 0;
  let requestInit: RequestInit = {
    ...init,
    redirect: "manual",
  };

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const response = await fetchImpl(currentUrl.href, requestInit);

    // Redirect status codes
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      hopCount++;
      if (hopCount > maxRedirects) {
        throw new NetworkBlockedError(`Redirect limit exceeded (max ${maxRedirects} hops)`);
      }

      const location = response.headers.get("location") || response.headers.get("Location");
      if (!location) {
        throw new NetworkBlockedError("Redirect response missing Location header");
      }

      const nextUrl = new URL(location, currentUrl);
      currentUrl = await assertSafeUrl(nextUrl, options);

      // Change POST to GET for 303, or 301/302 where typical
      if (
        response.status === 303 ||
        ((response.status === 301 || response.status === 302) &&
          requestInit.method?.toUpperCase() === "POST")
      ) {
        requestInit = {
          ...requestInit,
          method: "GET",
          body: undefined,
        };
      }
      continue;
    }

    return response;
  }

  throw new NetworkBlockedError(`Redirect limit exceeded (max ${maxRedirects} hops)`);
}
