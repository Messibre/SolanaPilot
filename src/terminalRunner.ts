import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

const DEPLOY_COMMANDS = {
  setDevnet: "solana config set --url devnet",
  airdrop: "solana airdrop 2",
  build: "anchor build",
  deploy: "anchor deploy",
} as const;

const DEPLOY_MESSAGES = {
  start: "SolanaPilot - Deploying to Devnet",
  config: "Configuring Solana CLI to devnet...",
  airdrop: "Airdropping SOL for deployment fees...",
  build: "Building Anchor program (this may take a few minutes)...",
  deploy: "Deploying to devnet...",
  warning:
    "Security note: your configured Solana keypair will be used. Review the target workspace before deploying.",
} as const;

const MARKERS = {
  airdropFailed: "AIRDROP_FAILED",
  buildFailed: "BUILD_FAILED",
  deploySuccess: "DEPLOY_SUCCESS",
  deployFailed: "DEPLOY_FAILED",
} as const;

export class TerminalRunner {
  private terminal: vscode.Terminal | undefined;
  private static instance: TerminalRunner | undefined;

  private constructor() {
    vscode.window.onDidCloseTerminal((closedTerminal) => {
      if (this.terminal && closedTerminal === this.terminal) {
        this.terminal = undefined;
      }
    });
  }

  public static getInstance(): TerminalRunner {
    if (!TerminalRunner.instance) {
      TerminalRunner.instance = new TerminalRunner();
    }

    return TerminalRunner.instance;
  }

  private getWindowsCmdPath(): string {
    const systemRoot =
      process.env.SystemRoot || process.env.WINDIR || "C:\\Windows";
    return path.join(systemRoot, "System32", "cmd.exe");
  }

  private getWindowsPowerShellPath(): string {
    const systemRoot =
      process.env.SystemRoot || process.env.WINDIR || "C:\\Windows";
    return path.join(
      systemRoot,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
  }

  private getOrCreateTerminal(name: string = "SolanaPilot"): vscode.Terminal {
    if (this.terminal) {
      return this.terminal;
    }

    this.terminal =
      process.platform === "win32"
        ? vscode.window.createTerminal({
            name,
            shellPath: this.getWindowsCmdPath(),
            iconPath: new vscode.ThemeIcon("rocket"),
            message: "SolanaPilot terminal",
          })
        : vscode.window.createTerminal({
            name,
            iconPath: new vscode.ThemeIcon("rocket"),
            message: "SolanaPilot terminal",
          });

    return this.terminal;
  }

  private quoteForShell(value: string): string {
    if (process.platform === "win32") {
      return `'${value.replace(/'/g, "''")}'`;
    }

    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  private buildChangeDirectoryCommand(targetPath: string): string {
    const quoted = this.quoteForShell(targetPath);
    return process.platform === "win32"
      ? `Set-Location -LiteralPath ${quoted}`
      : `cd ${quoted}`;
  }

  private pipeCommandToOutput(command: string, outputFile: string): string {
    const quotedOutput = this.quoteForShell(outputFile);
    return process.platform === "win32"
      ? `& ${command} 2>&1 | Tee-Object -FilePath ${quotedOutput} -Append`
      : `${command} 2>&1 | tee -a ${quotedOutput}`;
  }

  private appendOutputLine(outputFile: string, text: string): string {
    const quotedOutput = this.quoteForShell(outputFile);
    const quotedText = this.quoteForShell(text);
    return process.platform === "win32"
      ? `${quotedText} | Tee-Object -FilePath ${quotedOutput} -Append`
      : `echo ${quotedText} | tee -a ${quotedOutput}`;
  }

  private writeMarker(markerFile: string, value: string): string {
    const quotedMarker = this.quoteForShell(markerFile);
    const quotedValue = this.quoteForShell(value);
    return process.platform === "win32"
      ? `Set-Content -Path ${quotedMarker} -Value ${quotedValue}`
      : `echo ${quotedValue} > ${quotedMarker}`;
  }

  private quoteForCmd(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }

  private getNpmCommand(): string {
    return process.platform === "win32" ? "npm.cmd" : "npm";
  }

  private appendOutputChannelLine(
    outputChannel: vscode.OutputChannel,
    line: string,
  ): void {
    outputChannel.appendLine(line);
  }

  private detectVitePort(chunk: string): number | null {
    const patterns = [
      /Local:\s+http:\/\/localhost:(\d+)/i,
      /Local:\s+http:\/\/127\.0\.0\.1:(\d+)/i,
      /http:\/\/localhost:(\d+)/i,
      /http:\/\/127\.0\.0\.1:(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = chunk.match(pattern);
      if (match) {
        return Number(match[1]);
      }
    }

    return null;
  }

  private async runCommandInFolder(
    command: string,
    args: string[],
    cwd: string,
    outputChannel: vscode.OutputChannel,
  ): Promise<number> {
    return await new Promise<number>((resolve) => {
      const child = spawn(command, args, {
        cwd,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.stdout.on("data", (data: Buffer) => {
        this.appendOutputChannelLine(outputChannel, data.toString().trimEnd());
      });

      child.stderr.on("data", (data: Buffer) => {
        this.appendOutputChannelLine(outputChannel, data.toString().trimEnd());
      });

      child.on("close", (code) => {
        resolve(code ?? 0);
      });
    });
  }

  private async launchFrontendDevServer(
    appRoot: string,
    outputChannel: vscode.OutputChannel,
  ): Promise<number | null> {
    return await new Promise<number | null>((resolve) => {
      const npmCommand = this.getNpmCommand();
      const devProcess = spawn(npmCommand, ["run", "dev"], {
        cwd: appRoot,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let resolved = false;
      let buffer = "";

      const finalize = (port: number | null) => {
        if (resolved) {
          return;
        }

        resolved = true;
        resolve(port);
      };

      const handleChunk = (chunk: Buffer) => {
        const text = chunk.toString();
        buffer += text;
        this.appendOutputChannelLine(outputChannel, text.trimEnd());

        const detectedPort = this.detectVitePort(buffer);
        if (detectedPort && !resolved) {
          finalize(detectedPort);
          void vscode.env.openExternal(
            vscode.Uri.parse(`http://localhost:${detectedPort}`),
          );

          if (detectedPort !== 5173) {
            void vscode.window.showInformationMessage(
              `Vite started on port ${detectedPort} because port 5173 was in use.`,
            );
          }
        }

        if (/EADDRINUSE|Port 5173 is in use|trying another port/i.test(text)) {
          void vscode.window.showWarningMessage(
            "Port 5173 is already in use. Vite will pick another port automatically.",
          );
        }
      };

      devProcess.stdout.on("data", handleChunk);
      devProcess.stderr.on("data", handleChunk);

      devProcess.on("close", (code) => {
        if (!resolved) {
          this.appendOutputChannelLine(
            outputChannel,
            `Dev server exited before a port was detected (code ${code ?? 0}).`,
          );
          finalize(null);
        }
      });
    });
  }

  private buildDeployScript(
    workspaceRoot: string,
    markerFile: string,
    outputFile: string,
  ): string {
    const lines: string[] = [];
    const add = (line: string) => lines.push(line);

    // Set HOME environment variable as the first line on Windows
    if (process.platform === "win32") {
      add(`$env:HOME = $env:USERPROFILE`);
      add(`Write-Host "HOME environment variable set to: $env:HOME"`);
    }

    add(this.buildChangeDirectoryCommand(workspaceRoot));
    add(this.appendOutputLine(outputFile, ""));
    add(
      this.appendOutputLine(
        outputFile,
        "========================================",
      ),
    );
    add(this.appendOutputLine(outputFile, DEPLOY_MESSAGES.start));
    add(
      this.appendOutputLine(
        outputFile,
        "========================================",
      ),
    );
    add(this.appendOutputLine(outputFile, ""));
    add(this.appendOutputLine(outputFile, DEPLOY_MESSAGES.config));
    add(this.pipeCommandToOutput(DEPLOY_COMMANDS.setDevnet, outputFile));
    add(this.appendOutputLine(outputFile, ""));
    add(this.appendOutputLine(outputFile, DEPLOY_MESSAGES.build));

    add(this.pipeCommandToOutput(DEPLOY_COMMANDS.build, outputFile));

    if (process.platform === "win32") {
      add("if ($LASTEXITCODE -ne 0) {");
      add(`  ${this.appendOutputLine(outputFile, MARKERS.buildFailed)}`);
      add(`  ${this.writeMarker(markerFile, MARKERS.buildFailed)}`);
      add("  exit 1");
      add("}");
    } else {
      add("if [ $? -ne 0 ]; then");
      add(`  ${this.appendOutputLine(outputFile, MARKERS.buildFailed)}`);
      add(`  ${this.writeMarker(markerFile, MARKERS.buildFailed)}`);
      add("  exit 1");
      add("fi");
    }

    add(this.appendOutputLine(outputFile, ""));
    add(this.appendOutputLine(outputFile, DEPLOY_MESSAGES.deploy));
    add(this.pipeCommandToOutput(DEPLOY_COMMANDS.deploy, outputFile));

    if (process.platform === "win32") {
      add("if ($LASTEXITCODE -eq 0) {");
      add(`  ${this.appendOutputLine(outputFile, MARKERS.deploySuccess)}`);
      add(`  ${this.writeMarker(markerFile, "SUCCESS")}`);
      add("} else {");
      add(`  ${this.appendOutputLine(outputFile, MARKERS.deployFailed)}`);
      add(`  ${this.writeMarker(markerFile, "FAILED")}`);
      add("}");
    } else {
      add("if [ $? -eq 0 ]; then");
      add(`  ${this.appendOutputLine(outputFile, MARKERS.deploySuccess)}`);
      add(`  ${this.writeMarker(markerFile, "SUCCESS")}`);
      add("else");
      add(`  ${this.appendOutputLine(outputFile, MARKERS.deployFailed)}`);
      add(`  ${this.writeMarker(markerFile, "FAILED")}`);
      add("fi");
    }

    return lines.join("\n");
  }

  public async runDeploy(workspaceRoot: string): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
      `${DEPLOY_MESSAGES.warning}\n\nThis runs the full devnet deploy flow in the integrated terminal.`,
      { modal: true },
      "Proceed with Devnet Deploy",
      "Cancel",
    );

    if (confirmed !== "Proceed with Devnet Deploy") {
      vscode.window.showInformationMessage("Deployment cancelled.");
      return;
    }

    this.terminal?.dispose();
    this.terminal =
      process.platform === "win32"
        ? vscode.window.createTerminal({
            name: "SolanaPilot Deploy",
            shellPath: this.getWindowsCmdPath(),
            iconPath: new vscode.ThemeIcon("rocket"),
            message: "SolanaPilot deployment terminal",
          })
        : vscode.window.createTerminal({
            name: "SolanaPilot Deploy",
            iconPath: new vscode.ThemeIcon("rocket"),
            message: "SolanaPilot deployment terminal",
          });

    const terminal = this.terminal;
    terminal.show(true);

    const tempDir = os.tmpdir();
    const markerId = Date.now();
    const markerFile = path.join(
      tempDir,
      `solanapilot-deploy-${markerId}.marker`,
    );
    const outputFile = path.join(
      tempDir,
      `solanapilot-deploy-${markerId}.output`,
    );
    const scriptFile = path.join(tempDir, `solanapilot-deploy-${markerId}.ps1`);
    const script = this.buildDeployScript(
      workspaceRoot,
      markerFile,
      outputFile,
    );

    fs.writeFileSync(scriptFile, script, "utf8");

    const command =
      process.platform === "win32"
        ? `"${this.getWindowsPowerShellPath()}" -NoLogo -NoProfile -ExecutionPolicy Bypass -File ${this.quoteForCmd(scriptFile)}`
        : `pwsh -NoLogo -NoProfile -File ${this.quoteForShell(scriptFile)}`;

    terminal.sendText(command, true);

    await new Promise<void>((resolve) => {
      let checkCount = 0;
      const maxChecks = 360;

      const checkCompletion = async () => {
        checkCount++;

        if (checkCount > maxChecks) {
          this.cleanupTempFiles(markerFile, outputFile, scriptFile);
          vscode.window.showWarningMessage(
            "Deployment timed out after 6 minutes. Check the terminal for progress.",
          );
          resolve();
          return;
        }

        if (!fs.existsSync(markerFile)) {
          setTimeout(checkCompletion, 1000);
          return;
        }

        const marker = fs.readFileSync(markerFile, "utf8").trim();
        const output = fs.existsSync(outputFile)
          ? fs.readFileSync(outputFile, "utf8")
          : "";

        if (marker === "SUCCESS") {
          const programId = this.extractProgramId(output);
          await this.showDeploySuccessNotification(programId);
        } else if (marker === MARKERS.buildFailed) {
          await this.showBuildFailedNotification();
        } else if (marker === "FAILED") {
          await this.showDeployFailedNotification();
        }

        if (output.includes(MARKERS.airdropFailed)) {
          await this.showAirdropFailedNotification();
        }

        this.cleanupTempFiles(markerFile, outputFile, scriptFile);
        resolve();
      };

      void checkCompletion();
    });
  }

  private cleanupTempFiles(
    markerFile: string,
    outputFile: string,
    scriptFile?: string,
  ): void {
    try {
      if (fs.existsSync(markerFile)) {
        fs.unlinkSync(markerFile);
      }
      if (fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile);
      }
      if (scriptFile && fs.existsSync(scriptFile)) {
        fs.unlinkSync(scriptFile);
      }
    } catch {
      // Ignore cleanup failures.
    }
  }

  private extractProgramId(output: string): string | null {
    const match = output.match(/Program\s+Id:\s+([1-9A-HJ-NP-Za-km-z]{32,44})/);
    return match ? match[1] : null;
  }

  private async showAirdropFailedNotification(): Promise<void> {
    const action = await vscode.window.showWarningMessage(
      "Airdrop failed. Your devnet wallet may not be funded or the faucet may be rate-limited.",
      "Open Faucet",
      "OK",
    );

    if (action === "Open Faucet") {
      await vscode.env.openExternal(
        vscode.Uri.parse("https://faucet.solana.com"),
      );
    }
  }

  private async showBuildFailedNotification(): Promise<void> {
    await vscode.window.showErrorMessage(
      "Build failed. Check the terminal for details, then ask SolanaPilot Chat to help debug the output.",
    );
  }

  private async showDeployFailedNotification(): Promise<void> {
    await vscode.window.showErrorMessage(
      "Deployment to devnet failed. Check the terminal for details.",
    );
  }

  private async showDeploySuccessNotification(
    programId: string | null,
  ): Promise<void> {
    if (!programId) {
      await vscode.window.showInformationMessage(
        "Deployment completed, but the Program ID could not be parsed from terminal output.",
      );
      return;
    }

    const action = await vscode.window.showInformationMessage(
      `Deployed successfully. Program ID: ${programId}`,
      "View on Explorer",
    );

    if (action === "View on Explorer") {
      await vscode.env.openExternal(
        vscode.Uri.parse(
          `https://explorer.solana.com/address/${programId}?cluster=devnet`,
        ),
      );
    }
  }

  public runCommands(commands: string[], workspaceRoot: string): void {
    const terminal = this.getOrCreateTerminal();
    terminal.show(true);
    terminal.sendText(this.buildChangeDirectoryCommand(workspaceRoot));

    for (const command of commands) {
      terminal.sendText(command);
    }
  }

  public async runFrontendSetup(workspaceRoot: string): Promise<void> {
    const appRoot = path.join(workspaceRoot, "app");
    const outputChannel = vscode.window.createOutputChannel(
      "SolanaPilot Frontend",
    );
    outputChannel.show(true);
    this.appendOutputChannelLine(
      outputChannel,
      "SolanaPilot frontend setup starting...",
    );

    if (!fs.existsSync(appRoot)) {
      vscode.window.showErrorMessage(
        "The generated frontend folder was not found. Generate the frontend first.",
      );
      return;
    }

    this.appendOutputChannelLine(
      outputChannel,
      "Installing dependencies with npm install...",
    );
    const installCode = await this.runCommandInFolder(
      this.getNpmCommand(),
      ["install"],
      appRoot,
      outputChannel,
    );

    if (installCode !== 0) {
      vscode.window.showErrorMessage(
        "npm install failed. Check the SolanaPilot Frontend output for details.",
      );
      return;
    }

    this.appendOutputChannelLine(outputChannel, "Starting Vite dev server...");
    const detectedPort = await this.launchFrontendDevServer(
      appRoot,
      outputChannel,
    );

    if (!detectedPort) {
      vscode.window.showWarningMessage(
        "Frontend server started, but the active Vite port could not be detected automatically.",
      );
    }
  }
}
