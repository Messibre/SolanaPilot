import { GoogleGenerativeAI } from '@google/generative-ai'
import { SOLANA_SYSTEM_PROMPT } from './systemPrompt'

const MODEL_NAME = 'gemini-2.5-flash'

let genAI: GoogleGenerativeAI | undefined

export function initAI(apiKey: string): void {
  genAI = new GoogleGenerativeAI(apiKey)
}

export async function callAI(
  userMessage: string,
  workspaceContext: string,
  expectJSON: boolean = false
): Promise<string> {
  if (!genAI) {
    throw new Error('AI not initialized. Set your API key first.')
  }

  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: expectJSON ? 0.1 : 0.7,
      maxOutputTokens: expectJSON ? 8192 : 2048
    }
  })

  const systemPrompt = SOLANA_SYSTEM_PROMPT.replace(
    '{WORKSPACE_CONTEXT}',
    workspaceContext || 'No workspace context available'
  )

  const fullPrompt = `${systemPrompt}\n\nUSER REQUEST:\n${userMessage}`
  const result = await model.generateContent(fullPrompt)
  const response = result.response.text()

  if (!response || response.trim() === '') {
    throw new Error('Empty response from Gemini API')
  }

  return response
}
