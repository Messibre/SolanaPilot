import * as vscode from 'vscode'
import { initAI } from './aiClient'
import { getWorkspaceRoot } from './fileWriter'
import { generateAndDeploy } from './programGenerator'
import { TerminalRunner } from './terminalRunner'

async function configureApiKey(context: vscode.ExtensionContext): Promise<void> {
  const apiKey = await vscode.window.showInputBox({
    prompt: 'Enter your Gemini API key',
    ignoreFocusOut: true,
    password: true,
    validateInput: (value) => (value.trim().length === 0 ? 'API key is required' : undefined)
  })

  if (!apiKey) {
    return
  }

  await context.secrets.store('solanaPilot.geminiApiKey', apiKey.trim())
  initAI(apiKey.trim())
  void vscode.window.showInformationMessage('Gemini API key saved for SolanaPilot.')
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const savedKey = await context.secrets.get('solanaPilot.geminiApiKey')
  if (savedKey) {
    initAI(savedKey)
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('solanaCopilot.setApiKey', async () => {
      await configureApiKey(context)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('solanaCopilot.generateProgram', () => {
      void generateAndDeploy(context)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('solanaCopilot.deployToDevnet', () => {
      const root = getWorkspaceRoot()
      if (!root) {
        void vscode.window.showErrorMessage('Open a workspace folder first')
        return
      }

      const runner = TerminalRunner.getInstance()
      runner.runDeploy(root)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('solanaCopilot.generateFrontend', () => {
      void vscode.window.showInformationMessage(
        'Frontend generation is not part of this slice yet. Run it after deploy when Feature 4 is added.'
      )
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('solanaCopilot.openChat', () => {
      void vscode.window.showInformationMessage('Chat panel is not implemented in this Feature 2 slice.')
    })
  )
}

export function deactivate(): void {
  // No-op.
}
