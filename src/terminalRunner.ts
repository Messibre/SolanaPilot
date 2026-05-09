import * as vscode from "vscode";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";

// Terminal command constants for maintainability
const DEPLOY_COMMANDS = {
  SET_DEVNET: "solana config set --url devnet",
  AIRDROP: "solana airdrop 2",
  BUILD: "anchor build",
  DEPLOY: "anchor deploy",
};

const DEPLOY_MESSAGES = {
  START: "🚀 SolanaPilot — Deploying to Devnet",
  CONFIG: "🔧 Configuring Solana CLI to devnet...",
  AIRDROP: "💰 Airdropping SOL for deployment fees...",
  BUILD: "🏗️ Building Anchor program (this takes 2-4 minutes)...",
  DEPLOY: "🚀 Deploying to devnet...",
  WARNING:
    "⚠️ SECURITY: Your default keypair will be used. Never deploy from mainnet without review!",
};

const MARKERS = {
  AIRDROP_FAILED: "⚠️ AIRDROP_FAILED",
  BUILD_FAILED: "❌ BUILD_FAILED",
  DEPLOY_SUCCESS: "✅ DEPLOY_SUCCESS",
  DEPLOY_FAILED: "❌ DEPLOY_FAILED",
};

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

  private getOrCreateTerminal(): vscode.Terminal {
    if (this.terminal) {
      return this.terminal;
    }

    this.terminal = vscode.window.createTerminal({
      name: "🚀 Solana Copilot",
      iconPath: new vscode.ThemeIcon("rocket"),
      message: "SolanaPilot Deployment Terminal",
    });

    return this.terminal;
  }

  /**
   * Deploy a Solana Anchor program to devnet.
   * Creates a terminal, runs the full deployment pipeline,
   * watches for success/failure events, and shows appropriate notifications.
   * Includes private key security warnings.
   */
  public async runDeploy(workspaceRoot: string): Promise<void> {
    // Security check: warn user about using default keypair
    const confirmed = await vscode.window.showWarningMessage(
      DEPLOY_MESSAGES.WARNING +
        "\n\nDeploying to devnet only. Confirm you understand the security implications.",
      { modal: true },
      "Proceed with Devnet Deploy",
      "Cancel",
    );

    if (confirmed !== "Proceed with Devnet Deploy") {
      vscode.window.showInformationMessage("Deployment cancelled.");
      return;
    }

    const terminalName = "🚀 Solana Copilot";

    // Close any existing terminal with the same name
    vscode.window.terminals
      .filter((t) => t.name === terminalName)
      .forEach((t) => t.dispose());

    const terminal = vscode.window.createTerminal(terminalName);
    terminal.show(true);

    // Build the deployment script with error handling and markers
    const escapedWorkspaceRoot = workspaceRoot.replace(/"/g, '\\"');

    // Use a temp marker file to track completion
    const tempDir = os.tmpdir();
    const markerId = Date.now();
    const markerFile = path.join(tempDir, `solana-deploy-${markerId}.marker`);
    const outputFile = path.join(tempDir, `solana-deploy-${markerId}.output`);

    const script = `
cd "${escapedWorkspaceRoot}" 2>&1 | tee "${outputFile}"
echo "" | tee -a "${outputFile}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "${outputFile}"
echo "  ${DEPLOY_MESSAGES.START}" | tee -a "${outputFile}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "${outputFile}"
echo "" | tee -a "${outputFile}"
echo "${DEPLOY_MESSAGES.CONFIG}" | tee -a "${outputFile}"
${DEPLOY_COMMANDS.SET_DEVNET} 2>&1 | tee -a "${outputFile}"
echo "" | tee -a "${outputFile}"
echo "${DEPLOY_MESSAGES.AIRDROP}" | tee -a "${outputFile}"
${DEPLOY_COMMANDS.AIRDROP} 2>&1 | tee -a "${outputFile}" || echo "${MARKERS.AIRDROP_FAILED}" | tee -a "${outputFile}"
echo "" | tee -a "${outputFile}"
echo "${DEPLOY_MESSAGES.BUILD}" | tee -a "${outputFile}"
${DEPLOY_COMMANDS.BUILD} 2>&1 | tee -a "${outputFile}"
if [ $? -ne 0 ]; then
  echo "${MARKERS.BUILD_FAILED}" | tee -a "${outputFile}"
  echo "BUILD_FAILED" > "${markerFile}"
  exit 1
fi
echo "" | tee -a "${outputFile}"
echo "${DEPLOY_MESSAGES.DEPLOY}" | tee -a "${outputFile}"
${DEPLOY_COMMANDS.DEPLOY} 2>&1 | tee -a "${outputFile}"
if [ $? -eq 0 ]; then
  echo "${MARKERS.DEPLOY_SUCCESS}" | tee -a "${outputFile}"
  echo "SUCCESS" > "${markerFile}"
else
  echo "${MARKERS.DEPLOY_FAILED}" | tee -a "${outputFile}"
  echo "FAILED" > "${markerFile}"
fi
`;

    // Send the script to the terminal
    terminal.sendText(script);

    // Monitor the marker file for completion
    return new Promise<void>((resolve) => {
      let checkCount = 0;
      const maxChecks = 360; // 6 minutes with 1-second intervals

      const checkCompletion = async () => {
        checkCount++;

        if (checkCount > maxChecks) {
          // Timeout - clean up and resolve
          try {
            if (fs.existsSync(markerFile)) fs.unlinkSync(markerFile);
            if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
          } catch {
            // ignore cleanup errors
          }
          vscode.window.showWarningMessage(
            "Deployment timed out (6 minutes). Check the terminal for progress.",
          );
          resolve();
          return;
        }

        try {
          // Check if marker file exists
          if (fs.existsSync(markerFile)) {
            const marker = fs.readFileSync(markerFile, "utf-8").trim();
            const output = fs.existsSync(outputFile)
              ? fs.readFileSync(outputFile, "utf-8")
              : "";

            // Determine what to display
            if (marker === "SUCCESS") {
              const programId = this.extractProgramId(output);
              await this.showDeploySuccessNotification(programId);
            } else if (marker === "FAILED") {
              if (output.includes("BUILD_FAILED")) {
                await this.showBuildFailedNotification();
              } else {
                await this.showDeployFailedNotification();
              }
            }

            // Check for airdrop failure in output even if deployment continued
            if (output.includes(MARKERS.AIRDROP_FAILED)) {
              await this.showAirdropFailedNotification();
            }

            // Clean up temp files
            try {
              if (fs.existsSync(markerFile)) fs.unlinkSync(markerFile);
              if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
            } catch {
              // ignore cleanup errors
            }

            resolve();
            return;
          }
        } catch (err) {
          // Ignore file system errors and continue checking
        }

        // Schedule next check
        setTimeout(checkCompletion, 1000);
      };

      // Start checking
      checkCompletion();
    });
  }

  /**
   * Extract Program ID from anchor deploy output using regex.
   */
  private extractProgramId(output: string): string | null {
    const match = output.match(/Program\s+Id:\s+([1-9A-HJ-NP-Za-km-z]{32,44})/);
    return match ? match[1] : null;
  }

  /**
   * Show notification when airdrop fails.
   */
  private async showAirdropFailedNotification(): Promise<void> {
    const action = await vscode.window.showWarningMessage(
      "⚠️ Airdrop failed. Your devnet wallet may not be funded or the faucet may be rate-limited.",
      "Open Faucet",
      "OK",
    );

    if (action === "Open Faucet") {
      await vscode.env.openExternal(
        vscode.Uri.parse("https://faucet.solana.com"),
      );
    }
  }

  /**
   * Show notification when build fails.
   */
  private async showBuildFailedNotification(): Promise<void> {
    await vscode.window.showErrorMessage(
      "❌ Build failed. Check the terminal for details. You can copy the error and ask SolanaPilot Chat for help.",
    );
  }

  /**
   * Show notification when deployment fails.
   */
  private async showDeployFailedNotification(): Promise<void> {
    await vscode.window.showErrorMessage(
      "❌ Deployment to devnet failed. Check the terminal above.",
    );
  }

  /**
   * Show notification when deployment succeeds.
   */
  private async showDeploySuccessNotification(
    programId: string | null,
  ): Promise<void> {
    if (!programId) {
      await vscode.window.showInformationMessage(
        "✅ Deployment completed, but Program ID could not be parsed. Check the terminal output above.",
      );
      return;
    }

    const action = await vscode.window.showInformationMessage(
      `✅ Deployed! Program ID: ${programId}`,
      "View on Explorer",
    );

    if (action === "View on Explorer") {
      const explorerUrl = `https://explorer.solana.com/address/${programId}?cluster=devnet`;
      await vscode.env.openExternal(vscode.Uri.parse(explorerUrl));
    }
  }

  public runCommands(commands: string[], workspaceRoot: string): void {
    const terminal = this.getOrCreateTerminal();
    terminal.show(true);
    terminal.sendText(`cd "${workspaceRoot}"`);

    for (const command of commands) {
      terminal.sendText(command);
    }
  }

  public runFrontendSetup(workspaceRoot: string): void {
    const terminal = this.getOrCreateTerminal();
    terminal.show(true);
    terminal.sendText(`cd "${workspaceRoot}"`);
    terminal.sendText("cd app && npm install && npm run dev");
  }
}
