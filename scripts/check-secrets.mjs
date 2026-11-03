import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const SECRET_PATTERNS = [
  {
    name: "Gemini API Key",
    regex: /AIza[0-9A-Za-z-_]{35}/,
  },
  {
    name: "Anthropic API Key",
    regex: /sk-ant-[a-zA-Z0-9_-]{20,}/,
  },
  {
    name: "OpenAI API Key",
    regex: /sk-[a-zA-Z0-9_-]{20,}/,
  },
  {
    name: "GitHub Token",
    regex: /ghp_[a-zA-Z0-9]{36}/,
  },
  {
    name: "Solana 64-byte Keypair Array",
    regex: /\[\s*(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*){63}(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*\]/,
  },
  {
    name: "Base58 Key/Secret",
    regex: /(?:key|secret)\s*[:=]\s*["']?([1-9A-HJ-NP-Za-km-z]{80,90})["']?/i,
  },
  {
    name: "Bearer Token",
    regex: /Bearer\s+[a-zA-Z0-9_.\-~+/=]{20,}/,
  },
  {
    name: "Private Key Block",
    regex: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
  },
];

const PLACEHOLDER_SUBSTRINGS = [
  "your-",
  "your_",
  "your ",
  "<your",
  "placeholder",
  "dummy",
  "example",
  "mock",
  "fake",
  "test-",
  "xxxx",
  "...",
  "INSERT_",
  "CHANGE_ME",
];

export function isPlaceholder(text, filepath = "") {
  const normPath = filepath.replace(/\\/g, "/");
  if (normPath.endsWith(".env.example") || normPath.includes(".example")) {
    return true;
  }
  const lower = text.toLowerCase();
  return PLACEHOLDER_SUBSTRINGS.some((ph) => lower.includes(ph.toLowerCase()));
}

export function scanContent(content, filepath = "") {
  const findings = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    for (const pattern of SECRET_PATTERNS) {
      const match = pattern.regex.exec(line);
      if (match) {
        const matchedText = match[0];
        if (isPlaceholder(matchedText, filepath) || isPlaceholder(line, filepath)) {
          continue;
        }
        findings.push({
          file: filepath,
          line: lineNum,
          rule: pattern.name,
        });
      }
    }
  }

  return findings;
}

export function getTrackedAndStagedFiles(cwd = process.cwd()) {
  try {
    const tracked = execFileSync("git", ["ls-files"], { cwd, encoding: "utf8" })
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    const staged = execFileSync("git", ["diff", "--name-only", "--cached"], {
      cwd,
      encoding: "utf8",
    })
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    const all = Array.from(new Set([...tracked, ...staged]));
    return all.filter((file) => {
      // Exclude binary files or non-code by extension
      const ext = path.extname(file).toLowerCase();
      return !imageOrBinaryExts.has(ext);
    });
  } catch {
    return [];
  }
}

const imageOrBinaryExts = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".pdf",
  ".lock",
  ".vsix",
  ".wasm",
  ".so",
  ".dylib",
  ".dll",
  ".exe",
]);

export function runSecretScan(cwd = process.cwd()) {
  const files = getTrackedAndStagedFiles(cwd);
  const allFindings = [];

  for (const file of files) {
    const fullPath = path.resolve(cwd, file);
    if (!fs.existsSync(fullPath)) continue;
    let content;
    try {
      content = fs.readFileSync(fullPath, "utf8");
    } catch {
      continue;
    }
    const findings = scanContent(content, file);
    allFindings.push(...findings);
  }

  return allFindings;
}

if (process.argv[1] && (process.argv[1].endsWith("check-secrets.mjs") || process.argv[1].endsWith("check-secrets"))) {
  const findings = runSecretScan();
  if (findings.length > 0) {
    console.error(`Secret check FAILED: Found ${findings.length} potential secret(s):`);
    for (const f of findings) {
      // CRITICAL: print only file and line, never the matched text
      console.error(`  ${f.file}:${f.line} [${f.rule}]`);
    }
    process.exit(1);
  } else {
    console.log("Secret check: OK (no secrets detected)");
    process.exit(0);
  }
}
