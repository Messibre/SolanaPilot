import * as vscode from 'vscode'

export class TerminalRunner {
  private terminal: vscode.Terminal | undefined
  private static instance: TerminalRunner | undefined

  private constructor() {
    vscode.window.onDidCloseTerminal((closedTerminal) => {
      if (this.terminal && closedTerminal === this.terminal) {
        this.terminal = undefined
      }
    })
  }

  public static getInstance(): TerminalRunner {
    if (!TerminalRunner.instance) {
      TerminalRunner.instance = new TerminalRunner()
    }

    return TerminalRunner.instance
  }

  private getOrCreateTerminal(): vscode.Terminal {
    if (this.terminal) {
      return this.terminal
    }

    this.terminal = vscode.window.createTerminal({
      name: '🚀 SolanaPilot',
      iconPath: new vscode.ThemeIcon('rocket'),
      message: 'SolanaPilot Terminal - Solana CLI commands will run here'
    })

    return this.terminal
  }

  public runDeploy(workspaceRoot: string): void {
    const terminal = this.getOrCreateTerminal()
    terminal.show(true)
    terminal.sendText(`cd "${workspaceRoot}"`)
    terminal.sendText('echo ""')
    terminal.sendText('echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"')
    terminal.sendText('echo "  🚀 SolanaPilot — Deploying to Devnet"')
    terminal.sendText('echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"')
    terminal.sendText('echo ""')
    terminal.sendText('echo "Step 1/4: Configuring Solana CLI → devnet"')
    terminal.sendText('solana config set --url devnet')
    terminal.sendText('echo ""')
    terminal.sendText('echo "Step 2/4: Airdropping SOL for deployment fees"')
    terminal.sendText('solana airdrop 2')
    terminal.sendText('echo ""')
    terminal.sendText('echo "Step 3/4: Building Anchor program (takes 2-4 min)..."')
    terminal.sendText('anchor build')
    terminal.sendText('echo ""')
    terminal.sendText('echo "Step 4/4: Deploying to Solana devnet..."')
    terminal.sendText('anchor deploy')
    terminal.sendText('echo ""')
    terminal.sendText('echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"')
    terminal.sendText('echo "  ✅ Deployment complete!"')
    terminal.sendText('echo "  Copy the Program ID above to use your program"')
    terminal.sendText('echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"')
  }

  public runCommands(commands: string[], workspaceRoot: string): void {
    const terminal = this.getOrCreateTerminal()
    terminal.show(true)
    terminal.sendText(`cd "${workspaceRoot}"`)

    for (const command of commands) {
      terminal.sendText(command)
    }
  }

  public runFrontendSetup(workspaceRoot: string): void {
    const terminal = this.getOrCreateTerminal()
    terminal.show(true)
    terminal.sendText(`cd "${workspaceRoot}"`)
    terminal.sendText('cd app && npm install && npm run dev')
  }
}
