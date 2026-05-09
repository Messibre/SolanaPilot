import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { callAI } from "./aiClient";
import { getWorkspaceRoot } from "./fileWriter";
import { FRONTEND_PROMPT } from "./systemPrompt";
import { TerminalRunner } from "./terminalRunner";

interface FrontendGenerationResponse {
  type?: string;
  files?: Array<{ path: string; content: string }>;
  startCommand?: string;
}

/**
 * Find the Anchor IDL JSON file in target/idl/.
 */
async function findIDLFile(workspaceRoot: string): Promise<string | null> {
  try {
    const idlDir = path.join(workspaceRoot, "target", "idl");

    if (!fs.existsSync(idlDir)) {
      return null;
    }

    const files = fs.readdirSync(idlDir);
    let idlFile = files
      .filter((f) => f.endsWith(".json") && !f.endsWith("_test.json"))
      .sort((a, b) => {
        // Prefer smaller files (usually more recent)
        const statA = fs.statSync(path.join(idlDir, a));
        const statB = fs.statSync(path.join(idlDir, b));
        return statA.size - statB.size;
      })[0];

    return idlFile ? path.join(idlDir, idlFile) : null;
  } catch {
    return null;
  }
}

/**
 * Extract Program ID from Anchor.toml.
 */
async function extractProgramID(workspaceRoot: string): Promise<string | null> {
  try {
    const anchorToml = path.join(workspaceRoot, "Anchor.toml");

    if (!fs.existsSync(anchorToml)) {
      return null;
    }

    const content = fs.readFileSync(anchorToml, "utf-8");

    // Simple regex to extract [programs.devnet] program ID
    const match = content.match(
      /\[programs\.devnet\]\s*\n\s*([a-zA-Z0-9]+)\s*=\s*"([a-zA-Z0-9]+)"/,
    );
    if (match) {
      return match[2];
    }

    // Fallback: look for any program ID line
    const idMatch = content.match(
      /^[a-zA-Z0-9_]+\s*=\s*"([a-zA-Z0-9]{32,44})"/m,
    );
    return idMatch ? idMatch[1] : null;
  } catch {
    return null;
  }
}

/**
 * Parse AI response for frontend generation.
 */
function parseFrontendResponse(raw: string): FrontendGenerationResponse {
  let cleaned = raw.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  }
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  cleaned = cleaned.trim();
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("AI response does not contain valid JSON.");
  }

  let slice = cleaned.slice(jsonStart, jsonEnd + 1);

  let parsed: FrontendGenerationResponse;
  try {
    parsed = JSON.parse(slice) as FrontendGenerationResponse;
  } catch (err) {
    // Try to repair unescaped newlines in content
    try {
      const repaired = slice.replace(
        /"content"\s*:\s*"([\s\S]*?)"/g,
        (match) => {
          return match
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r")
            .replace(/\t/g, "\\t");
        },
      );
      parsed = JSON.parse(repaired) as FrontendGenerationResponse;
    } catch (err2) {
      throw new Error(
        "AI response JSON is malformed and could not be repaired.",
      );
    }
  }

  if (!parsed.files || !Array.isArray(parsed.files)) {
    throw new Error("AI response missing files array.");
  }

  if (parsed.files.length === 0) {
    throw new Error("AI returned empty files array.");
  }

  for (const file of parsed.files) {
    if (
      !file ||
      typeof file.path !== "string" ||
      file.path.trim().length === 0
    ) {
      throw new Error("AI response contains invalid file entries.");
    }

    if (typeof file.content !== "string") {
      throw new Error(`File content for ${file.path} is not a string.`);
    }

    // Sanitize paths
    if (path.isAbsolute(file.path)) {
      throw new Error(`Refusing to write absolute path: ${file.path}`);
    }

    const normalized = path.normalize(file.path);
    if (normalized.split(path.sep).includes("..")) {
      throw new Error(
        `Refusing to write file with path traversal: ${file.path}`,
      );
    }
  }

  return parsed;
}

/**
 * Build the AI prompt for frontend generation.
 */
function buildFrontendPrompt(idlJson: unknown, programId: string): string {
  const idlStr = JSON.stringify(idlJson, null, 2);

  return `${FRONTEND_PROMPT}

PROGRAM_ID: ${programId}

IDL_JSON:
\`\`\`json
${idlStr}
\`\`\`

Now generate the complete React frontend for this program.`;
}

/**
 * Generate and write frontend files to workspace.
 */
export async function generateFrontend(workspaceRoot: string): Promise<void> {
  try {
    // Step 1: Find IDL file
    const idlFilePath = await findIDLFile(workspaceRoot);
    if (!idlFilePath) {
      void vscode.window.showErrorMessage(
        "❌ No Anchor IDL found. Build your program first: run `anchor build`",
      );
      return;
    }

    // Step 2: Read and parse IDL
    let idlJson: unknown;
    try {
      const idlContent = fs.readFileSync(idlFilePath, "utf-8");
      idlJson = JSON.parse(idlContent);
    } catch (err) {
      void vscode.window.showErrorMessage(
        "❌ Failed to parse IDL file. Ensure `anchor build` completed successfully.",
      );
      return;
    }

    // Step 3: Extract Program ID
    let programId = await extractProgramID(workspaceRoot);
    if (!programId) {
      const input = await vscode.window.showInputBox({
        prompt:
          "📌 Enter the Program ID (from Anchor.toml or deployed program)",
        placeHolder: "e.g., 11111111111111111111111111111111",
        ignoreFocusOut: true,
        validateInput: (val) =>
          val.trim().length >= 32
            ? undefined
            : "Program ID must be at least 32 characters.",
      });

      if (!input) {
        return;
      }

      programId = input.trim();
    }

    // Step 4: Call AI to generate frontend
    let generated: FrontendGenerationResponse | undefined;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "⚡ SolanaPilot: Generating React frontend...",
        cancellable: false,
      },
      async (progress) => {
        progress.report({
          message: "Crafting React app with Anchor client...",
        });

        const fullPrompt = buildFrontendPrompt(idlJson, programId!);
        const rawResponse = await callAI(fullPrompt, "", true);

        progress.report({ message: "Parsing generated code..." });
        generated = parseFrontendResponse(rawResponse);

        if (!generated) {
          throw new Error("No response from AI");
        }

        progress.report({ message: "Writing files to workspace..." });
        writeGeneratedFiles(workspaceRoot, generated.files!);
      },
    );

    if (!generated) {
      return;
    }

    // Step 5: Offer to start dev server
    const choice = await vscode.window.showInformationMessage(
      "✅ Frontend generated! Ready to start the dev server?",
      { modal: false },
      "Start Now",
      "Later",
    );

    if (choice === "Start Now") {
      startDevServer(workspaceRoot);
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown frontend generation error";
    void vscode.window.showErrorMessage(
      `❌ Frontend generation failed: ${message}`,
    );
  }
}

/**
 * Write generated files to workspace.
 */
function writeGeneratedFiles(
  workspaceRoot: string,
  files: Array<{ path: string; content: string }>,
): void {
  const MAX_FILE_BYTES = 1_000_000; // 1 MB for frontend files

  for (const file of files) {
    // Validate size
    if (Buffer.byteLength(file.content, "utf-8") > MAX_FILE_BYTES) {
      throw new Error(
        `File too large: ${file.path} exceeds ${MAX_FILE_BYTES} bytes`,
      );
    }

    const normalized = path.normalize(file.path);
    const fullPath = path.resolve(workspaceRoot, normalized);

    // Ensure path is within workspace
    if (!fullPath.startsWith(path.resolve(workspaceRoot))) {
      throw new Error(`Refusing to write outside workspace: ${file.path}`);
    }

    // Create directories recursively
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });

    // Write file
    fs.writeFileSync(fullPath, file.content, "utf-8");
    console.log("[SolanaPilot] Wrote:", file.path);
  }

  // Open App.tsx in editor
  try {
    const appTsxPath = path.join(workspaceRoot, "app", "src", "App.tsx");
    if (fs.existsSync(appTsxPath)) {
      void openFileInEditor(appTsxPath);
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Open a file in the editor.
 */
async function openFileInEditor(absolutePath: string): Promise<void> {
  try {
    const doc = await vscode.workspace.openTextDocument(
      vscode.Uri.file(absolutePath),
    );
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
  } catch {
    // Non-fatal
  }
}

/**
 * Start the Vite dev server and open browser.
 * Handles port conflicts gracefully with helpful messages.
 */
function startDevServer(workspaceRoot: string): void {
  const terminal = vscode.window.createTerminal({
    name: "🖥️ Solana dApp",
    iconPath: new vscode.ThemeIcon("globe"),
    message: "Solana React dApp Dev Server",
  });

  terminal.show(true);

  // Run npm install and dev
  const escapedRoot = workspaceRoot.replace(/"/g, '\\"');
  const script = `
cd "${escapedRoot}/app" 2>&1
echo "📦 Installing dependencies..."
npm install
if [ $? -eq 0 ]; then
  echo ""
  echo "🚀 Starting dev server..."
  echo "ℹ️  If port 5173 is already in use, Vite will automatically try the next port (5174, 5175, etc)"
  echo ""
  npm run dev 2>&1 | tee dev-server.log
  if grep -q "EADDRINUSE" dev-server.log 2>/dev/null; then
    echo ""
    echo "⚠️  Port 5173 is already in use. Check the output above for the actual port being used."
    echo "💡 Tip: Close any other dev servers or use 'lsof -i :5173' to find the process."
  fi
else
  echo "❌ npm install failed. Check the error above."
  echo "💡 Try running 'npm install' manually in the app/ directory."
fi
`;

  terminal.sendText(script);

  // Open browser after 4 seconds (Vite needs time to start)
  // This will try localhost:5173, which may redirect if that port is in use
  setTimeout(() => {
    void vscode.env.openExternal(vscode.Uri.parse("http://localhost:5173"));
  }, 4000);

  // Show helpful info message
  vscode.window.showInformationMessage(
    "🚀 Dev server starting... Opening browser at localhost:5173 (check terminal if port conflict occurs)",
    "View Log",
  );
}
