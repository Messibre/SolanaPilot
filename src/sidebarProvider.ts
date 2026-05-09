import * as vscode from "vscode";

/**
 * Sidebar provider module â€” VS Code sidebar panel for devnet status
 * Used by: Devnet Deploy Helper Panel feature
 */

export class DevnetStatusProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    void element;
    return Promise.resolve([]);
  }

  /**
   * Register the sidebar provider
   */
  static register(context: vscode.ExtensionContext): void {
    void context;
    console.log("[SolanaPilot] Sidebar provider stub (coming soon)");
  }
}
