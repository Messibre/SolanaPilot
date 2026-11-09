import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { LogEvent, LogSink } from "../core/logger";
import { redact } from "../security/redact";

export interface OutputChannelLike {
  appendLine(value: string): void;
  show(preserveFocus?: boolean): void;
  dispose(): void;
}

export class OutputChannelSink implements LogSink {
  constructor(private readonly channel: OutputChannelLike) {}

  public emit(event: LogEvent): void {
    const dataStr = event.data ? ` ${JSON.stringify(redact(event.data))}` : "";
    const catStr = event.category ? ` [${event.category}]` : "";
    const line = `[${event.ts}] [${event.level.toUpperCase()}] [${event.component}:${event.phase}]${catStr} ${event.message}${dataStr}`;
    this.channel.appendLine(line);
  }

  public show(preserveFocus = true): void {
    this.channel.show(preserveFocus);
  }

  public dispose(): void {
    this.channel.dispose();
  }
}

export interface JsonlFileSinkOptions {
  storageDir: string;
  filename?: string;
  maxBytes?: number;
  maxRotatedFiles?: number;
}

export class JsonlFileSink implements LogSink {
  private readonly storageDir: string;
  private readonly filename: string;
  private readonly maxBytes: number;
  private readonly maxRotatedFiles: number;

  constructor(options: JsonlFileSinkOptions) {
    this.storageDir = options.storageDir;
    this.filename = options.filename ?? "solanapilot.log.jsonl";
    this.maxBytes = options.maxBytes ?? 512 * 1024;
    this.maxRotatedFiles = options.maxRotatedFiles ?? 3;
  }

  public getLogPath(): string {
    return path.join(this.storageDir, this.filename);
  }

  public emit(event: LogEvent): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }

      // Defensive redaction ensures zero secrets land in logs
      const safeEvent = redact(event);
      const line = JSON.stringify(safeEvent) + "\n";
      const lineBytes = Buffer.byteLength(line, "utf8");
      const basePath = this.getLogPath();

      const currentSize = fs.existsSync(basePath)
        ? fs.statSync(basePath).size
        : 0;

      if (currentSize + lineBytes > this.maxBytes) {
        this.rotate(basePath);
      }

      fs.appendFileSync(basePath, line, "utf8");
    } catch {
      // Sinks must never throw or crash caller
    }
  }

  private rotate(basePath: string): void {
    try {
      // Rotate existing rotated files: .2 -> .3, .1 -> .2
      for (let i = this.maxRotatedFiles; i >= 1; i--) {
        const src = `${basePath}.${i}`;
        const dst = `${basePath}.${i + 1}`;
        if (fs.existsSync(src)) {
          if (i + 1 <= this.maxRotatedFiles) {
            fs.renameSync(src, dst);
          } else {
            fs.unlinkSync(src);
          }
        }
      }

      // Rotate active file: basePath -> basePath.1
      if (fs.existsSync(basePath)) {
        fs.renameSync(basePath, `${basePath}.1`);
      }
    } catch {
      // Rotation failures must not crash logging
    }
  }
}

export async function exportRunReceipt(
  receipt: unknown,
  targetPathOrUri?: string | { fsPath: string },
): Promise<string | undefined> {
  let targetPath: string | undefined;

  if (typeof targetPathOrUri === "string") {
    targetPath = targetPathOrUri;
  } else if (targetPathOrUri && "fsPath" in targetPathOrUri) {
    targetPath = targetPathOrUri.fsPath;
  } else if (vscode?.window?.showSaveDialog) {
    const defaultName = `solanapilot-receipt-${Date.now()}.json`;
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultName),
      filters: { "JSON Files": ["json"] },
      saveLabel: "Export Receipt",
    });
    if (!uri) return undefined;
    targetPath = uri.fsPath;
  }

  if (!targetPath) return undefined;

  const safeReceipt = redact(receipt);
  const formatted = JSON.stringify(safeReceipt, null, 2);
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(targetPath, formatted, "utf8");
  return targetPath;
}
