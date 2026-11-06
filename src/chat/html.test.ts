import { describe, expect, it } from "vitest";
import { buildChatHtml, type WebviewHtmlOptions } from "./html";

describe("Webview HTML Builder (T-051)", () => {
  const defaultOptions: WebviewHtmlOptions = {
    cspSource: "vscode-webview://*",
    styleUri: "vscode-resource://media/chat.css",
    scriptUri: "vscode-resource://media/chat.js",
    nonce: "test-random-nonce-1234567890abcdef",
  };

  it("includes CSP with nonce and default-src 'none'", () => {
    const html = buildChatHtml(defaultOptions);
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("default-src 'none'");
    expect(html).toContain(`script-src 'nonce-${defaultOptions.nonce}'`);
    expect(html).toContain(`style-src ${defaultOptions.cspSource}`);
  });

  it("links chat.css and chat.js via webview URIs with nonce on script", () => {
    const html = buildChatHtml(defaultOptions);
    expect(html).toContain('href="vscode-resource://media/chat.css"');
    expect(html).toContain(`nonce="${defaultOptions.nonce}"`);
    expect(html).toContain('src="vscode-resource://media/chat.js"');
  });

  it("contains zero inline event handlers (no onclick, onchange, onsubmit, etc.)", () => {
    const html = buildChatHtml(defaultOptions);
    const inlineHandlerPattern = /\son[a-z]+\s*=/i;
    expect(html).not.toMatch(inlineHandlerPattern);
  });

  it("contains zero remote URLs (no https://, http://, cdn, unpkg, etc.)", () => {
    const html = buildChatHtml(defaultOptions);
    const bodyWithoutCsp = html.replace(/<meta[^>]*Content-Security-Policy[^>]*>/i, "");
    expect(bodyWithoutCsp).not.toMatch(/href\s*=\s*["'](?:\/\/|https?:)/i);
    expect(bodyWithoutCsp).not.toMatch(/src\s*=\s*["'](?:\/\/|https?:)/i);
    expect(bodyWithoutCsp).not.toMatch(/url\(["']?(?:\/\/|https?:)/i);
    expect(bodyWithoutCsp).not.toMatch(/https?:\/\//i);
  });

  it("contains accessible pipeline progress view with aria-live", () => {
    const html = buildChatHtml(defaultOptions);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('id="pipeline-progress"');
    expect(html).toContain('id="budget-meter"');
    expect(html).toContain('id="plan-preview"');
    expect(html).toContain('id="build-log"');
    expect(html).toContain('id="review-findings"');
    expect(html).toContain('id="receipt-summary"');
    expect(html).toContain('id="error-banner"');
  });

  it("contains provider and model selector with accessible labels", () => {
    const html = buildChatHtml(defaultOptions);
    expect(html).toContain('id="provider-select"');
    expect(html).toContain('id="model-select"');
    expect(html).toContain('aria-label="Select AI Provider"');
    expect(html).toContain('aria-label="Select Model"');
  });
});
