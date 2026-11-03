/**
 * Tool result wrapping and injection screening.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { z } from "zod";
import { screenForInjection } from "../../security/injectionScreen";
import type { Tool, ToolContext } from "./types";

export interface WrappedToolResult<T = unknown> {
  data: T;
  envelope: string;
  flagged: boolean;
  reasons: string[];
}

export function createWrappedOutputSchema<TOut>(
  dataSchema: z.ZodType<TOut, z.ZodTypeDef, unknown>
): z.ZodType<WrappedToolResult<TOut>, z.ZodTypeDef, unknown> {
  return z.object({
    data: dataSchema,
    envelope: z.string(),
    flagged: z.boolean(),
    reasons: z.array(z.string()),
  }) as z.ZodType<WrappedToolResult<TOut>, z.ZodTypeDef, unknown>;
}

/**
 * Serializes raw tool data for inclusion in the untrusted envelope.
 */
function serializeToolData(data: unknown): string {
  if (data === null || data === undefined) {
    return "";
  }
  if (typeof data === "string") {
    return data;
  }
  return JSON.stringify(data, null, 2);
}

/**
 * Wraps a tool execution result in a delimited untrusted data envelope,
 * running the injection screen and attaching warning metadata if flagged.
 */
export function wrapToolResult<T = unknown>(toolName: string, result: T): WrappedToolResult<T> {
  const serialized = serializeToolData(result);
  const screen = screenForInjection(serialized);

  const warningHeader = screen.flagged ? ' WARNING_POSSIBLE_INJECTION="true"' : "";
  const warningComment = screen.flagged
    ? `<!-- WARNING: Potential prompt injection detected: ${screen.reasons.join(", ")} -->\n`
    : "";

  const envelope = `<untrusted_tool_result tool="${toolName}"${warningHeader}>\n${warningComment}${serialized}\n</untrusted_tool_result>`;

  return {
    data: result,
    envelope,
    flagged: screen.flagged,
    reasons: screen.reasons,
  };
}

/**
 * Creates a wrapped Tool that automatically screens and wraps outputs.
 */
export function wrapToolWithScreen<TIn, TOut>(tool: Tool<TIn, TOut>): Tool<TIn, WrappedToolResult<TOut>> {
  return {
    name: tool.name,
    description: tool.description,
    input: tool.input,
    output: createWrappedOutputSchema(tool.output),
    sideEffects: tool.sideEffects,
    execute: async (input: TIn, context: ToolContext): Promise<WrappedToolResult<TOut>> => {
      const rawResult = await tool.execute(input, context);
      return wrapToolResult(tool.name, rawResult);
    },
  };
}
