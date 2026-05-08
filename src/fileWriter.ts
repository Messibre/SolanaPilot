import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'

export interface WorkspaceFile {
  path: string
  content: string
}

export function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath
}

export async function openFileInEditor(absolutePath: string): Promise<void> {
  try {
    if (!fs.existsSync(absolutePath)) {
      return
    }

    const doc = await vscode.workspace.openTextDocument(absolutePath)
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One)
  } catch {
    // Silent failure as requested.
  }
}

export async function writeFilesToWorkspace(files: WorkspaceFile[]): Promise<boolean> {
  try {
    const workspaceRoot = getWorkspaceRoot()
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('Please open a folder first (File → Open Folder)')
      return false
    }

    for (const file of files) {
      const fullPath = path.join(workspaceRoot, file.path)
      const dir = path.dirname(fullPath)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(fullPath, file.content, 'utf8')
      console.log('SolanaPilot wrote:', file.path)
    }

    const libRsFile = files.find((file) => file.path.endsWith('lib.rs'))
    if (libRsFile) {
      const libRsPath = path.join(workspaceRoot, libRsFile.path)
      const doc = await vscode.workspace.openTextDocument(libRsPath)
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.One)
    }

    vscode.window.showInformationMessage(`✅ Generated ${files.length} files for your Solana program`)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown file write error'
    vscode.window.showErrorMessage(`Failed to write generated files: ${message}`)
    return false
  }
}
