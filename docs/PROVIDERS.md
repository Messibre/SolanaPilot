# SolanaPilot AI Provider System

SolanaPilot is built on a multi-provider AI gateway that abstracts large language models behind a uniform contract. It gives hackathon builders flexibility: run with Google Gemini, Anthropic Claude, OpenAI-compatible APIs (OpenAI, OpenRouter, Groq), or completely locally and offline using Ollama without incurring API costs.

---

## 1. Supported Providers

| Provider | ID | Default Model | Authentication | Implementation Notes |
|---|---|---|---|---|
| **Google Gemini** | `gemini` | `gemini-2.5-flash` | API Key (`SecretStorage`) | Uses official `@google/genai` SDK |
| **Anthropic** | `anthropic` | `claude-3-5-sonnet-20241022` | API Key (`SecretStorage`) | Native Node.js `fetch` (Zero external SDK) |
| **OpenAI-Compatible** | `openai` | `gpt-4o-mini` | API Key (`SecretStorage`) | Native Node.js `fetch` (Supports OpenRouter, Groq, vLLM) |
| **Ollama** | `ollama` | `deepseek-r1:14b` | None (Localhost) | Native Node.js `fetch` (Offline / Zero cost) |
| **Mock** | `mock` | `scripted-mock` | None | In-memory scripted fixtures for deterministic testing |

---

## 2. Setting Up Providers in VS Code

1. Press `Ctrl+Alt+S` (or `Cmd+Alt+S` on macOS) to open the SolanaPilot Chat Panel.
2. Select your provider and model using the command palette:
   - Command: `SolanaPilot: Select Provider and Model`
3. Provide your API key (if required):
   - Command: `SolanaPilot: Set API Key`
   - Keys are stored securely in VS Code `SecretStorage`. Keys are never saved to git, settings files, log files, receipts, or transmitted to external servers other than the designated provider endpoint.
4. Verify connectivity:
   - Command: `SolanaPilot: Test Connection`

### Running Free & Offline with Ollama

For zero-cost hackathon iteration:
1. Install Ollama: `https://ollama.com`
2. Pull a recommended reasoning or coding model:
   ```bash
   ollama pull deepseek-r1:14b
   # or
   ollama pull llama3.1
   ```
3. In VS Code, execute `SolanaPilot: Select Provider and Model`, choose `ollama`, and enter `deepseek-r1:14b`.
4. No API key is required. Loopback requests (`http://127.0.0.1:11434`) are permitted exclusively for Ollama under the SSRF policy.

---

## 3. Architecture & Gateway Contract

All providers implement the `LlmProvider` interface defined in `src/ai/types.ts`:

```typescript
export interface LlmProvider {
  readonly id: ProviderId;
  generate(prompt: string, options?: GenerateOptions): Promise<LlmResult>;
  stream?(prompt: string, onChunk: (chunk: string) => void, options?: GenerateOptions): Promise<LlmResult>;
}
```

### Gateway Guarantees
- **Timeout Management**: Outbound requests are bound to an `AbortController` timeout (default 30 seconds).
- **Exponential Backoff**: Automatic retry for transient 429 (rate-limit) and 5xx errors with jitter (max 2 retries). Client errors (400, 401, 403) fail immediately without retry.
- **Defensive Error Normalization**: All errors are normalized into typed `AppError` categories (`provider_timeout`, `provider_rate_limited`, `provider_error`, `config`).
- **Structured JSON Repair**: When structured outputs are required, the `StructuredGenerator` (`src/ai/structured.ts`) validates outputs against Zod schemas and executes automated repair prompts if parsing fails.

---

## 4. How to Add a New AI Provider

SolanaPilot follows strict architectural hygiene: **No third-party SDKs** for HTTP-based providers (with the exception of `@google/genai`). New providers are implemented using native Node.js `fetch`.

### Step 1: Create the Provider Implementation

Create a new file in `src/ai/providers/<providerName>.ts`:

```typescript
import { LlmProvider, LlmResult, GenerateOptions } from "../types";
import { AppError } from "../../core/errors";

export interface CustomProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetchFn?: typeof fetch;
}

export class CustomProvider implements LlmProvider {
  readonly id = "custom" as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: CustomProviderOptions) {
    if (!options.apiKey) {
      throw new AppError("API key is required for Custom provider", "config");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.custom.com/v1";
    this.model = options.model ?? "default-model";
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<LlmResult> {
    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: options?.model ?? this.model,
          messages: [{ role: "user", content: prompt }],
          temperature: options?.temperature ?? 0.2,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new AppError("Rate limit exceeded", "provider_rate_limited");
        }
        throw new AppError(`Provider returned HTTP ${response.status}`, "provider_error");
      }

      const data = await response.json();
      return {
        text: data.choices[0].message.content,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new AppError("Provider request timed out", "provider_timeout");
      }
      throw new AppError(`Provider network error: ${err}`, "provider_error");
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
```

### Step 2: Register Provider in AI Gateway

In `src/ai/gateway.ts`:
1. Add the provider identifier to `ProviderId` union in `src/ai/types.ts`.
2. Instantiate the provider in `AiGateway.createProvider(id, config)`.

### Step 3: Add Unit Tests

Create `src/ai/providers/<providerName>.test.ts`:
- Inject a mock `fetchFn` to simulate HTTP 200, HTTP 429 (rate-limit), and network timeouts.
- Red-green check each failure mode to ensure errors map to the expected failure category.
- Verify that `verify` passes offline without making external network calls.

