import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogEvent } from "../core/logger";

vi.mock("vscode", () => ({
  window: {
    showSaveDialog: vi.fn(),
  },
  Uri: {
    file: (f: string) => ({ fsPath: f }),
  },
}));

import { JsonlFileSink, OutputChannelSink, exportRunReceipt } from "./logSinks";

describe("Telemetry Sinks & Rotation (T-052)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "solanapilot-test-logs-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  const createSampleEvent = (msg: string, data?: unknown): LogEvent => ({
    ts: "2026-11-06T10:00:00.000Z",
    level: "info",
    component: "agent",
    phase: "EXECUTE",
    spanId: "span_1",
    message: msg,
    data,
  });

  it("writes valid JSONL entries to log file", () => {
    const sink = new JsonlFileSink({
      storageDir: tempDir,
      maxBytes: 10_000,
      maxRotatedFiles: 3,
    });

    sink.emit(createSampleEvent("First log line", { step: 1 }));
    sink.emit(createSampleEvent("Second log line", { step: 2 }));

    const logPath = sink.getLogPath();
    expect(fs.existsSync(logPath)).toBe(true);

    const content = fs.readFileSync(logPath, "utf8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);

    const parsed1 = JSON.parse(lines[0]);
    expect(parsed1.message).toBe("First log line");
    expect(parsed1.data.step).toBe(1);

    const parsed2 = JSON.parse(lines[1]);
    expect(parsed2.message).toBe("Second log line");
    expect(parsed2.data.step).toBe(2);
  });

  it("proves rotation when file size exceeds maxBytes", () => {
    // Each log line is ~130-150 bytes, so maxBytes=250 will rotate after 2 lines
    const sink = new JsonlFileSink({
      storageDir: tempDir,
      filename: "test.log.jsonl",
      maxBytes: 250,
      maxRotatedFiles: 2,
    });

    sink.emit(createSampleEvent("Event number 1 which has a bit of length"));
    sink.emit(createSampleEvent("Event number 2 which has a bit of length"));
    sink.emit(createSampleEvent("Event number 3 which triggers rotation"));
    sink.emit(createSampleEvent("Event number 4 which adds to new file"));
    sink.emit(createSampleEvent("Event number 5 which triggers second rotation"));

    const baseFile = path.join(tempDir, "test.log.jsonl");
    const rot1 = path.join(tempDir, "test.log.jsonl.1");
    const rot2 = path.join(tempDir, "test.log.jsonl.2");
    const rot3 = path.join(tempDir, "test.log.jsonl.3");

    expect(fs.existsSync(baseFile)).toBe(true);
    expect(fs.existsSync(rot1)).toBe(true);
    expect(fs.existsSync(rot2)).toBe(true);
    // Max rotated files is 2, so .3 must not exist
    expect(fs.existsSync(rot3)).toBe(false);
  });

  it("proves that fake secrets never land in the JSONL log file", () => {
    const sink = new JsonlFileSink({
      storageDir: tempDir,
      maxBytes: 50_000,
    });

    const fakeAnthropicKey = "sk-ant-api03-abcdef1234567890abcdef1234567890";
    const fakeGithubToken = "ghp_123456789012345678901234567890123456";
    const fakeSolanaPrivateKey = [
      12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12,
      34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34,
    ];

    sink.emit(
      createSampleEvent(`Received key ${fakeAnthropicKey}`, {
        token: fakeGithubToken,
        secretKey: fakeSolanaPrivateKey,
        nested: {
          innerKey: fakeAnthropicKey,
        },
      }),
    );

    const logPath = sink.getLogPath();
    const rawFileContent = fs.readFileSync(logPath, "utf8");

    // Must NOT contain any raw secret strings
    expect(rawFileContent).not.toContain(fakeAnthropicKey);
    expect(rawFileContent).not.toContain(fakeGithubToken);

    // Must contain redaction indicator
    expect(rawFileContent).toMatch(/\[redacted:[^\]]+\]/i);
  });

  it("OutputChannelSink emits formatted lines to output channel", () => {
    const emittedLines: string[] = [];
    const mockChannel = {
      name: "SolanaPilot",
      appendLine: (line: string) => emittedLines.push(line),
      show: () => {},
      dispose: () => {},
    };

    const channelSink = new OutputChannelSink(mockChannel);
    channelSink.emit(createSampleEvent("Channel test message", { ok: true }));

    expect(emittedLines).toHaveLength(1);
    expect(emittedLines[0]).toContain("[INFO]");
    expect(emittedLines[0]).toContain("[agent:EXECUTE]");
    expect(emittedLines[0]).toContain("Channel test message");
  });

  it("exportRunReceipt deeply redacts receipt before writing", async () => {
    const fakeKey = "sk-ant-api03-secret1234567890abcdef123456";
    const receipt = {
      terminalState: "success",
      reason: `Finished with token ${fakeKey}`,
      steps: 3,
      tokensUsed: 450,
      metadata: {
        rawKey: fakeKey,
      },
    };

    const targetFile = path.join(tempDir, "receipt.json");
    await exportRunReceipt(receipt, targetFile);

    expect(fs.existsSync(targetFile)).toBe(true);
    const content = fs.readFileSync(targetFile, "utf8");

    expect(content).not.toContain(fakeKey);
    expect(content).toContain('"terminalState": "success"');
  });
});
