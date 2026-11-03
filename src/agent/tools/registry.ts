/**
 * Tool registry for agent tool execution and validation.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { z } from "zod";
import { SolanaPilotError, ToolCrashedError, ToolRefusedError } from "../../core/errors";
import type { Tool, ToolContext } from "./types";

export class ToolRegistry {
  private readonly tools = new Map<string, Tool<unknown, unknown>>();

  /**
   * Registers a tool in the registry.
   */
  public register(tool: Tool<unknown, unknown>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Retrieves a tool by name.
   */
  public get(name: string): Tool<unknown, unknown> | undefined {
    return this.tools.get(name);
  }

  /**
   * Checks if a tool is registered.
   */
  public has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Returns all registered tools.
   */
  public getAll(): Tool<unknown, unknown>[] {
    return Array.from(this.tools.values());
  }

  /**
   * Returns registered tool names.
   */
  public getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Executes a tool with input validation, output validation, and error wrapping.
   */
  public async execute(name: string, rawInput: unknown, context: ToolContext): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      const validTools = this.getNames().sort().join(", ");
      throw new ToolRefusedError(
        `Unknown tool "${name}". Valid tools: ${validTools || "(none registered)"}`
      );
    }

    const parseResult = tool.input.safeParse(rawInput);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((iss) => `${iss.path.join(".") || "root"}: ${iss.message}`)
        .join("; ");

      let extraHint = "";
      if (tool.input instanceof z.ZodObject) {
        const validKeys = Object.keys(tool.input.shape).join(", ");
        extraHint = ` Valid parameters: [${validKeys}].`;
      }

      throw new ToolRefusedError(
        `Invalid arguments for tool "${tool.name}": ${issues}.${extraHint}`
      );
    }

    try {
      const result = await tool.execute(parseResult.data, context);

      const outputResult = tool.output.safeParse(result);
      if (!outputResult.success) {
        throw new ToolCrashedError(
          `Tool "${tool.name}" returned invalid output schema: ${outputResult.error.message}`
        );
      }
      return outputResult.data;
    } catch (err: unknown) {
      if (err instanceof SolanaPilotError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new ToolCrashedError(`Tool "${tool.name}" crashed during execution: ${message}`, err);
    }
  }
}
