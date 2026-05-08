import * as vscode from 'vscode'
import { callAI } from './aiClient'
import { getWorkspaceRoot, type WorkspaceFile, writeFilesToWorkspace } from './fileWriter'
import { PROGRAM_GENERATION_PROMPT } from './systemPrompt'
import { TerminalRunner } from './terminalRunner'

interface ProgramGenerationResponse {
  files: WorkspaceFile[]
  programName: string
  description: string
  instructions: string[]
}

function buildProgramPrompt(description: string, programName: string): string {
  return `${PROGRAM_GENERATION_PROMPT}

You are an expert Solana developer. Generate a COMPLETE, DEPLOYABLE Anchor
smart contract for the following:

PROGRAM DESCRIPTION: ${description}
PROGRAM NAME: ${programName}

REQUIREMENTS:
- Use Anchor framework (not native Rust)
- Maximum 3 instructions (keep it simple for hackathon)
- Include proper PDAs where state is needed
- Include #[error_code] enum with at least 2 custom errors
- Include account validation constraints on ALL accounts (has_one, mut, signer, etc)
- Add inline comments explaining Solana-specific decisions
- The code must COMPILE with: anchor build (Anchor 0.30+, Solana 1.18+)
- Use i64 for any numeric counters/amounts to avoid overflow issues
- Every instruction must validate all inputs

ANCHOR VERSION: 0.30.0
SOLANA VERSION: 1.18.0

OUTPUT FORMAT: Return ONLY a valid JSON object. No markdown, no backticks,
no explanation before or after. The JSON must match this exact schema:

{
  "type": "full_program",
  "programName": "${programName}",
  "description": "one sentence description of what this program does",
  "files": [
    {
      "path": "programs/${programName}/src/lib.rs",
      "content": "complete rust file content here"
    },
    {
      "path": "programs/${programName}/Cargo.toml",
      "content": "complete Cargo.toml content"
    },
    {
      "path": "Anchor.toml",
      "content": "complete Anchor.toml configured for devnet"
    },
    {
      "path": "Cargo.toml",
      "content": "workspace Cargo.toml content"
    },
    {
      "path": "tests/${programName}.ts",
      "content": "basic anchor test file"
    }
  ],
  "instructions": ["list", "of", "instruction", "names"],
  "accounts": ["list", "of", "account", "struct", "names"]
}

CRITICAL: The JSON must be parseable by JSON.parse(). Escape all special
characters in file contents. Use \\n for newlines inside JSON strings.
`
}

function parseAIResponse(raw: string): ProgramGenerationResponse {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  }
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  cleaned = cleaned.trim()

  const jsonStart = cleaned.indexOf('{')
  const jsonEnd = cleaned.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('AI did not return valid JSON. Try again.')
  }

  cleaned = cleaned.slice(jsonStart, jsonEnd + 1)

  const parsed = JSON.parse(cleaned) as Partial<ProgramGenerationResponse>

  if (!parsed.files || !Array.isArray(parsed.files)) {
    throw new Error('AI response missing files array')
  }
  if (parsed.files.length === 0) {
    throw new Error('AI returned empty files array')
  }

  return {
    files: parsed.files,
    programName: typeof parsed.programName === 'string' ? parsed.programName : '',
    description: typeof parsed.description === 'string' ? parsed.description : '',
    instructions: Array.isArray(parsed.instructions)
      ? parsed.instructions.filter((item): item is string => typeof item === 'string')
      : []
  }
}

async function callAIWithSingleRetry(prompt: string): Promise<ProgramGenerationResponse> {
  try {
    const rawResponse = await callAI(prompt, '', true)
    return parseAIResponse(rawResponse)
  } catch (error) {
    vscode.window.showErrorMessage('Failed to parse AI response. Retrying...')
    const retryPrompt = `${prompt}

Your previous response was not valid JSON.
Return ONLY the JSON object with no other text.`

    try {
      const retryResponse = await callAI(retryPrompt, '', true)
      return parseAIResponse(retryResponse)
    } catch (retryError) {
      const retryMessage = retryError instanceof Error ? retryError.message : 'Unknown AI error'
      const choice = await vscode.window.showErrorMessage(
        `Failed to generate valid program JSON: ${retryMessage}`,
        'Open Chat'
      )

      if (choice === 'Open Chat') {
        void vscode.commands.executeCommand('solanaCopilot.openChat')
      }

      throw new Error(retryMessage)
    }
  }
}

export async function generateAndDeploy(context: vscode.ExtensionContext): Promise<void> {
  void context

  try {
    const description = await vscode.window.showInputBox({
      prompt: '🧠 Describe your Solana program',
      placeHolder: 'e.g. A voting program where users create polls and cast votes on-chain',
      ignoreFocusOut: true,
      validateInput: (val) =>
        val.trim().length < 10
          ? 'Please describe your program in more detail (min 10 characters)'
          : undefined
    })

    if (!description) {
      return
    }

    const suggestedName = description
      .split(' ')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')

    const rawName = await vscode.window.showInputBox({
      prompt: '📦 Program name (snake_case)',
      placeHolder: 'e.g. voting_program',
      value: suggestedName,
      validateInput: (val) =>
        /^[a-z][a-z0-9_]*$/.test(val)
          ? undefined
          : 'Use only lowercase letters, numbers, and underscores. Must start with a letter.'
    })

    if (!rawName) {
      return
    }

    const programName = rawName.trim()
    let generated: ProgramGenerationResponse | undefined

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `⚡ SolanaPilot: Generating "${programName}"...`,
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: 'Crafting your Solana program with Gemini AI...' })
        const fullPrompt = buildProgramPrompt(description, programName)
        generated = await callAIWithSingleRetry(fullPrompt)

        progress.report({ message: 'Parsing generated code...' })
        if (!generated) {
          throw new Error('No AI response received')
        }

        progress.report({ message: 'Writing files to workspace...' })
        const wrote = await writeFilesToWorkspace(generated.files)
        if (!wrote) {
          throw new Error('Failed to write generated files to workspace')
        }
      }
    )

    if (!generated) {
      return
    }

    const files = generated.files
    const choice = await vscode.window.showInformationMessage(
      `✅ "${programName}" generated! ${files.length} files written. Ready to deploy?`,
      { modal: false },
      'Deploy to Devnet',
      'View Code Only',
      'Also Generate Frontend'
    )

    if (choice === 'Deploy to Devnet') {
      const runner = TerminalRunner.getInstance()
      runner.runDeploy(getWorkspaceRoot()!)
    } else if (choice === 'Also Generate Frontend') {
      const runner = TerminalRunner.getInstance()
      runner.runDeploy(getWorkspaceRoot()!)
      void vscode.window.showInformationMessage(
        '🏗️ Deploy running. Run "SolanaPilot: Generate Frontend" after deploy completes.'
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown generator error'
    vscode.window.showErrorMessage(`SolanaPilot could not generate the program: ${message}`)
  }
}
