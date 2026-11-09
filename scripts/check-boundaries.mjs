import fs from "node:fs";
import path from "node:path";

const RESTRICTED_DIRS = [
  path.join("src", "core"),
  path.join("src", "security"),
  path.join("src", "ai"),
  path.join("src", "agent"),
];

const FORBIDDEN_IMPORT_REGEX = /(?:from\s*['"]vscode(?:\/.*)?['"]|require\s*\(\s*['"]vscode(?:\/.*)?['"]\)|import\s*\(\s*['"]vscode(?:\/.*)?['"]\))/;

export function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Ignore pure comments
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
      continue;
    }
    if (FORBIDDEN_IMPORT_REGEX.test(line)) {
      violations.push({
        file: filePath,
        line: i + 1,
        text: trimmed,
      });
    }
  }

  return violations;
}

export function scanDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  const violations = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      violations.push(...scanDirectory(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".js") || entry.name.endsWith(".mjs"))) {
      violations.push(...checkFile(fullPath));
    }
  }

  return violations;
}

export function runBoundaryCheck(baseDir = process.cwd()) {
  const allViolations = [];
  for (const restricted of RESTRICTED_DIRS) {
    const fullDirPath = path.join(baseDir, restricted);
    allViolations.push(...scanDirectory(fullDirPath));
  }
  return allViolations;
}

if (process.argv[1] && (process.argv[1].endsWith("check-boundaries.mjs") || process.argv[1].endsWith("check-boundaries"))) {
  const violations = runBoundaryCheck();
  if (violations.length > 0) {
    console.error(`Boundary check FAILED: ${violations.length} forbidden vscode import(s) detected:`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}: ${v.text}`);
    }
    process.exit(1);
  } else {
    console.log("Boundary check: OK (no forbidden vscode imports in core, security, ai, agent)");
    process.exit(0);
  }
}
