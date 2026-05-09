import * as vscode from 'vscode'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { SOLANA_SYSTEM_PROMPT } from './systemPrompt'
import { rateLimiter } from './rateLimiter'

const MODEL_NAME = 'gemini-2.5-flash'

let genAI: GoogleGenerativeAI | undefined

export function initAI(apiKey: string): void {
  genAI = new GoogleGenerativeAI(apiKey)
}

/**
 * Truncate workspace context to prevent token bloat and accidental secret exposure.
 * Keeps active file (~2000 chars) + other files (~2000 chars) within 4000 char limit.
 */
function truncateContext(context: string): string {
  const MAX_CONTEXT_LENGTH = 4000;
  if (context.length <= MAX_CONTEXT_LENGTH) {
    return context;
  }
  return context.substring(0, MAX_CONTEXT_LENGTH) + "\n\n...[truncated due to length]";
}

export async function callAI(
  userMessage: string,
  workspaceContext: string,
  expectJSON: boolean = false
): Promise<string> {
  if (!genAI) {
    throw new Error('AI not initialized. Set your API key first.')
  }

  // Check rate limit
  const rateLimitCheck = rateLimiter.checkAndRecord();
  if (!rateLimitCheck.allowed) {
    const resetTime = rateLimitCheck.resetAt?.toLocaleTimeString() || 'soon';
    throw new Error(
      `Rate limit reached: 50 calls per hour. Try again at ${resetTime}. ` +
      `This limit protects your API quota and prevents abuse.`
    );
  }

  // Show warning if nearing rate limit
  if (rateLimitCheck.remaining <= 5) {
    await vscode.window.showWarningMessage(
      `⚠️ Only ${rateLimitCheck.remaining} AI calls remaining this hour. Use them wisely!`
    );
  }

  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: expectJSON ? 0.1 : 0.7,
      maxOutputTokens: expectJSON ? 8192 : 2048,
    }
  })

  // Truncate context to prevent token bloat and secret exposure
  const truncatedContext = truncateContext(workspaceContext || '');

  const systemPrompt = SOLANA_SYSTEM_PROMPT.replace(
    '{WORKSPACE_CONTEXT}',
    truncatedContext || 'No workspace context available'
  )

  const fullPrompt = `${systemPrompt}\n\nUSER REQUEST:\n${userMessage}`
  
  try {
    const result = await model.generateContent(fullPrompt)
    const response = result.response.text()

    if (!response || response.trim() === '') {
      throw new Error('Empty response from Gemini API. Please try again.')
    }

    return response
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        throw new Error('Invalid API key. Check your Gemini API setup.');
      }
      if (error.message.includes('rate')) {
        throw new Error('API rate limited. Please wait before trying again.');
      }
      throw error;
    }
    throw new Error('Unknown error calling AI API. Check your network and API key.');
  }
}
