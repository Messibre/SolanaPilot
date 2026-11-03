/**
 * Agent tool registry and tool implementations.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Must NEVER import 'vscode'.
 */

import { fetchDocsTool } from "./fetchDocs";
import { listDirTool, readFileTool, searchTextTool, writeFileTool } from "./fs";
import { ToolRegistry } from "./registry";
import { runCheckTool } from "./runCheck";

export * from "./types";
export * from "./registry";
export * from "./fs";
export * from "./runCheck";
export * from "./fetchDocs";
export * from "./wrap";

export const AGENT_TOOLS_MODULE = "agent/tools";

/**
 * Creates and initializes a registry with all core tools.
 */
export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(readFileTool);
  registry.register(listDirTool);
  registry.register(searchTextTool);
  registry.register(writeFileTool);
  registry.register(runCheckTool);
  registry.register(fetchDocsTool);
  return registry;
}
