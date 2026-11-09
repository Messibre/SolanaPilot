/**
 * Structured output extraction and repair pipeline.
 * Adheres strictly to Agent.md §6, §8, and §10.
 * Zero vscode imports allowed.
 */

import { z } from "zod";
import type { LlmClient, LlmRequest } from "./types";
import { SchemaViolationError } from "../core/errors";

export interface GenerateStructuredOptions {
  maxRepairs?: number;
}

export interface StructuredResult<T> {
  data: T;
  raw: string;
  repairs: number;
}

/**
 * Base schema fields required by all structured output schemas per Agent.md §10.
 */
export interface StructuredOutputBase {
  needsHumanReview: boolean;
  uncertainty?: string;
}

/**
 * Strips markdown fences, preambles, and postambles, extracting valid JSON.
 */
export function extractJson(text: string): unknown {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : text.trim();

  const substring = findBalancedJsonSubstring(candidate);
  return JSON.parse(substring);
}

/**
 * Scans string for balanced outermost JSON object or array.
 */
function findBalancedJsonSubstring(str: string): string {
  const firstCurly = str.indexOf("{");
  const firstSquare = str.indexOf("[");

  let start = -1;
  let openChar = "{";
  let closeChar = "}";

  if (firstCurly !== -1 && firstSquare !== -1) {
    if (firstCurly < firstSquare) {
      start = firstCurly;
      openChar = "{";
      closeChar = "}";
    } else {
      start = firstSquare;
      openChar = "[";
      closeChar = "]";
    }
  } else if (firstCurly !== -1) {
    start = firstCurly;
    openChar = "{";
    closeChar = "}";
  } else if (firstSquare !== -1) {
    start = firstSquare;
    openChar = "[";
    closeChar = "]";
  } else {
    return str;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < str.length; i++) {
    const char = str[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === openChar) {
        depth++;
      } else if (char === closeChar) {
        depth--;
        if (depth === 0) {
          return str.substring(start, i + 1);
        }
      }
    }
  }

  return str.substring(start);
}

/**
 * Checks whether the parsed data structure is substantively empty.
 */
export function isEmptyContent(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === "string") return val.trim().length === 0;
  if (Array.isArray(val)) {
    return val.length === 0 || val.every(isEmptyContent);
  }
  if (typeof val === "object") {
    const keys = Object.keys(val as Record<string, unknown>).filter(
      (k) => k !== "needsHumanReview" && k !== "uncertainty"
    );
    if (keys.length === 0) return true;
    return keys.every((k) => isEmptyContent((val as Record<string, unknown>)[k]));
  }
  return false;
}

/**
 * Generates structured output conforming to a Zod schema with an automated repair pipeline.
 */
export async function generateStructured<T extends StructuredOutputBase>(
  client: LlmClient,
  schema: z.ZodType<T>,
  request: LlmRequest,
  options?: GenerateStructuredOptions
): Promise<StructuredResult<T>> {
  const maxRepairs = options?.maxRepairs ?? 1;
  const strictSchema = schema instanceof z.ZodObject ? schema.strict() : schema;

  const messages = [...request.messages];
  let lastRawText = "";
  let lastErrorMsg = "Unknown error";

  for (let repair = 0; repair <= maxRepairs; repair++) {
    const currentReq: LlmRequest = {
      ...request,
      jsonMode: true,
      messages,
    };

    const result = await client.generate(currentReq);
    lastRawText = result.text;

    let parsedJson: unknown;
    try {
      parsedJson = extractJson(result.text);
    } catch (err: unknown) {
      lastErrorMsg = `Invalid JSON syntax: ${(err as Error).message}`;
      if (repair < maxRepairs) {
        messages.push(
          { role: "assistant", content: result.text },
          { role: "user", content: buildRepairPrompt(lastErrorMsg) }
        );
        continue;
      }
      break;
    }

    const parseResult = strictSchema.safeParse(parsedJson);
    if (parseResult.success) {
      const data = parseResult.data as T;
      if (isEmptyContent(data)) {
        data.needsHumanReview = true;
        if (!data.uncertainty) {
          data.uncertainty = "Output content is empty or contains no substantive items";
        }
      }
      return {
        data,
        raw: result.text,
        repairs: repair,
      };
    }

    const issues = parseResult.error.issues
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
    lastErrorMsg = `Schema validation failed: ${issues}`;

    if (repair < maxRepairs) {
      messages.push(
        { role: "assistant", content: result.text },
        { role: "user", content: buildRepairPrompt(lastErrorMsg) }
      );
    }
  }

  throw new SchemaViolationError(
    `Structured output validation failed after ${maxRepairs + 1} attempts. Last error: ${lastErrorMsg}`,
    new Error(lastRawText)
  );
}

function buildRepairPrompt(errorDetails: string): string {
  return `Your previous response could not be processed.
Error: ${errorDetails}

Please correct the error and return ONLY valid JSON matching the requested schema. Do not include markdown fences, preamble, or commentary.`;
}
