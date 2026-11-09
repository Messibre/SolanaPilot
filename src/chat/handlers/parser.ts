import * as path from "path";
import type { WorkspaceFile } from "../../fileWriter";
import type { WorkspaceUpdateResponse } from "../types";

export function extractJsonObject(raw: string): string {
  const cleaned = raw.trim();
  const startIndex = cleaned.indexOf("{");
  if (startIndex === -1) {
    throw new Error("Agent mode did not return valid JSON.");
  }

  let inString = false;
  let escaped = false;
  let depth = 0;

  for (let index = startIndex; index < cleaned.length; index++) {
    const char = cleaned[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return cleaned.slice(startIndex, index + 1);
      }
    }
  }

  return cleaned.slice(startIndex);
}

export function repairJsonText(rawJson: string): string {
  let inString = false;
  let escaped = false;
  let repaired = "";

  for (let index = 0; index < rawJson.length; index++) {
    const char = rawJson[index];

    if (inString) {
      if (escaped) {
        repaired += char;
        escaped = false;
        continue;
      }
      if (char === "\\") {
        repaired += char;
        escaped = true;
        continue;
      }
      if (char === '"') {
        repaired += char;
        inString = false;
        continue;
      }
      if (char === "\n") {
        repaired += "\\n";
        continue;
      }
      if (char === "\r") {
        repaired += "\\r";
        continue;
      }
      if (char === "\t") {
        repaired += "\\t";
        continue;
      }
      repaired += char;
      continue;
    }

    if (char === '"') {
      inString = true;
      repaired += char;
      continue;
    }

    repaired += char;
  }

  return repaired;
}

export function closeIncompleteJsonObject(rawJson: string): string {
  let inString = false;
  let escaped = false;
  let openBraces = 0;
  let completed = "";

  for (let index = 0; index < rawJson.length; index++) {
    const char = rawJson[index];

    if (inString) {
      completed += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    completed += char;
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      openBraces += 1;
      continue;
    }
    if (char === "}") {
      openBraces = Math.max(0, openBraces - 1);
    }
  }

  if (inString) {
    completed += '"';
  }

  while (openBraces > 0) {
    completed += "}";
    openBraces -= 1;
  }

  return completed;
}

export function parseWorkspaceUpdateResponse(raw: string): WorkspaceUpdateResponse {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);

  const slice = extractJsonObject(cleaned);
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice) as unknown;
  } catch (err) {
    try {
      const repaired = repairJsonText(slice);
      const completed = closeIncompleteJsonObject(repaired);
      parsed = JSON.parse(completed) as unknown;
    } catch (err2) {
      throw new Error(
        `Agent mode returned malformed JSON and automatic repair failed. ${err instanceof Error ? err.message : String(err)}; ${err2 instanceof Error ? err2.message : String(err2)}`,
      );
    }
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Agent mode response must be a JSON object.");
  }

  const response = parsed as Record<string, unknown>;
  if (response.type !== "workspace_update") {
    throw new Error('Agent mode response must include "type": "workspace_update".');
  }

  if (!Array.isArray(response.files)) {
    throw new Error("Agent mode response is missing a files array.");
  }

  const MAX_FILE_BYTES = 500_000;
  const validatedFiles: WorkspaceFile[] = [];

  for (const file of response.files) {
    if (!file || typeof file.path !== "string" || file.path.trim().length === 0) {
      throw new Error("Agent mode returned invalid file entries.");
    }
    if (typeof file.content !== "string") {
      throw new Error(`File content for ${file.path} is not a string.`);
    }
    if (path.isAbsolute(file.path)) {
      throw new Error(`Refusing to write absolute file path: ${file.path}`);
    }
    const normalized = path.normalize(file.path);
    if (normalized.split(path.sep).includes("..")) {
      throw new Error(`Refusing to write file with path traversal segments: ${file.path}`);
    }
    if (Buffer.byteLength(file.content, "utf8") > MAX_FILE_BYTES) {
      throw new Error(`File too large: ${file.path} exceeds ${MAX_FILE_BYTES} bytes`);
    }

    validatedFiles.push({
      path: file.path,
      content: file.content,
    });
  }

  if (response.openFile && typeof response.openFile !== "string") {
    throw new Error("Agent mode returned an invalid openFile value.");
  }

  if (
    typeof response.openFile === "string" &&
    (path.isAbsolute(response.openFile) ||
      path.normalize(response.openFile) === ".." ||
      path.normalize(response.openFile).startsWith(`..${path.sep}`))
  ) {
    throw new Error("Agent mode returned an unsafe openFile path.");
  }

  if (response.notes && !Array.isArray(response.notes)) {
    throw new Error("Agent mode returned invalid notes.");
  }

  return {
    type: "workspace_update",
    summary: typeof response.summary === "string" ? response.summary : undefined,
    files: validatedFiles,
    notes: Array.isArray(response.notes)
      ? response.notes.filter((item): item is string => typeof item === "string")
      : undefined,
    openFile: typeof response.openFile === "string" ? response.openFile : undefined,
  };
}

