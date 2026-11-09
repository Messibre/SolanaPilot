/**
 * Security boundary guards: redact, pathGuard, urlGuard, injectionScreen.
 * Boundary constraint: Must NEVER import 'vscode'.
 */
export * from "./redact";
export * from "./pathGuard";
export const SECURITY_MODULE = "security";
