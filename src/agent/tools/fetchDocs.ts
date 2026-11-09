/**
 * Tool for fetching documentation from allowlisted domains.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { z } from "zod";
import { ToolRefusedError } from "../../core/errors";
import { guardedFetch } from "../../security/urlGuard";
import type { Tool } from "./types";

export const MAX_DOCS_BYTES = 200 * 1024; // 200 KB clamp

const FetchDocsInput = z
  .object({
    url: z.string().url("A valid URL is required"),
  })
  .strict();

const FetchDocsOutput = z.object({
  url: z.string(),
  content: z.string(),
  status: z.number().int(),
  bytes: z.number().int().nonnegative(),
  truncated: z.boolean(),
});

export const ALLOWED_DOCS_DOMAINS_DESCRIPTION =
  "solana.com, anchor-lang.com, docs.rs, and github.com raw documentation (raw.githubusercontent.com or /raw/ paths)";

export function isAllowedDocsDomain(url: URL): boolean {
  const host = url.hostname.toLowerCase();

  if (host === "solana.com" || host.endsWith(".solana.com")) {
    return true;
  }
  if (host === "anchor-lang.com" || host.endsWith(".anchor-lang.com")) {
    return true;
  }
  if (host === "docs.rs" || host.endsWith(".docs.rs")) {
    return true;
  }
  if (host === "raw.githubusercontent.com") {
    return true;
  }
  if (host === "github.com" && url.pathname.includes("/raw/")) {
    return true;
  }

  return false;
}

export const fetchDocsTool: Tool<z.input<typeof FetchDocsInput>, z.infer<typeof FetchDocsOutput>> = {
  name: "fetch_docs",
  description:
    "Fetch documentation from allowlisted domains (https, solana.com, anchor-lang.com, docs.rs, github raw docs).",
  input: FetchDocsInput,
  output: FetchDocsOutput,
  sideEffects: "network",
  execute: async (rawInput, context) => {
    const input = FetchDocsInput.parse(rawInput);
    let parsed: URL;
    try {
      parsed = new URL(input.url);
    } catch {
      throw new ToolRefusedError(
        `Invalid URL "${input.url}". Valid alternatives: specify a valid HTTPS URL.`
      );
    }

    if (parsed.protocol !== "https:") {
      throw new ToolRefusedError(
        `Only HTTPS URLs are permitted for fetch_docs. Received "${parsed.protocol}". Valid alternatives: use https://...`
      );
    }

    if (!isAllowedDocsDomain(parsed)) {
      throw new ToolRefusedError(
        `Domain or URL "${input.url}" is not permitted for fetch_docs. Valid alternatives: ${ALLOWED_DOCS_DOMAINS_DESCRIPTION}.`
      );
    }

    const fetchResponse = await (context.fetchFn
      ? context.fetchFn(input.url)
      : guardedFetch(input.url, undefined, {
          allowLoopback: false,
          dnsResolver: context.dnsResolver,
        }));

    const rawText = await fetchResponse.text();
    let content = rawText;
    let truncated = false;

    if (Buffer.byteLength(content, "utf-8") > MAX_DOCS_BYTES) {
      content = content.slice(0, MAX_DOCS_BYTES);
      truncated = true;
    }

    return {
      url: input.url,
      content,
      status: fetchResponse.status,
      bytes: Buffer.byteLength(content, "utf-8"),
      truncated,
    };
  },
};
