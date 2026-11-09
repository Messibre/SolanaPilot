/**
 * Injection screen to detect prompt injection patterns in untrusted tool output.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

export interface InjectionScreenResult {
  flagged: boolean;
  reasons: string[];
}

interface InjectionRule {
  id: string;
  pattern: RegExp;
  reason: string;
}

const INJECTION_RULES: InjectionRule[] = [
  // 1. Instruction override / ignore directives
  {
    id: "instruction-override",
    pattern:
      /\b(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:previous|prior|above|existing|system)\s+(?:instructions|rules|prompts|directives|guidelines)\b/i,
    reason: "Attempts to override or ignore prior instructions or guidelines",
  },
  {
    id: "instruction-reset",
    pattern:
      /\b(?:from now on|henceforth),?\s+(?:you\s+(?:must|should)\s+)?(?:ignore|disregard|forget)\s+(?:all\s+)?(?:rules|instructions|prompts)\b/i,
    reason: "Attempts to reset or replace instructions going forward",
  },

  // 2. System prompt forgery and fake tags
  {
    id: "system-prompt-forgery",
    pattern:
      /(?:^|\n)\s*(?:system prompt|\[system(?:[ _]message)?\]|<\|?(?:im_start|system)\|?>|<<SYS>>)\s*[:\]>]/i,
    reason: "Impersonates system prompt headers or formatting tokens",
  },
  {
    id: "developer-mode-jailbreak",
    pattern:
      /\b(?:you are now in|enable|enter|switch to)\s+(?:developer mode|DAN mode|unrestricted mode|jailbreak mode)\b/i,
    reason: "Attempts to activate developer or jailbreak mode",
  },

  // 3. Role impersonation / safety evasion
  {
    id: "role-impersonation",
    pattern:
      /\b(?:you are now|pretend (?:to be|you are))\s+(?:an? unrestricted|a jailbroken|an unfiltered|a rogue|an evil|an obedient)\s+(?:ai|assistant|model|bot|agent)\b/i,
    reason: "Attempts role impersonation to bypass safety restrictions",
  },
  {
    id: "safety-filter-bypass",
    pattern:
      /\b(?:ignore|disable|bypass|turn off)\s+(?:all\s+)?(?:safety filters?|content filters?|guardrails?)\b/i,
    reason: "Directly instructs to disable safety filters or guardrails",
  },

  // 4. Exfiltration and system prompt extraction
  {
    id: "data-exfiltration",
    pattern:
      /\b(?:send|exfiltrate|post|upload)\s+(?:all\s+)?(?:private keys?|api[ _]?keys?|secrets?|\.env|passwords?|tokens?)\s+(?:to\s+https?:\/\/)/i,
    reason: "Instructs exfiltration of secrets or credentials to external URL",
  },
  {
    id: "prompt-leak-directive",
    pattern:
      /\b(?:print|output|display|reveal|dump)\s+(?:the\s+)?(?:system prompt|initial instructions|developer instructions|hidden prompt)\b/i,
    reason: "Directs disclosure of system instructions or hidden prompts",
  },
];

/**
 * Screens text (such as tool output or fetched documentation) for injection patterns.
 */
export function screenForInjection(text: string): InjectionScreenResult {
  if (!text || typeof text !== "string") {
    return { flagged: false, reasons: [] };
  }

  const reasons: string[] = [];

  for (const rule of INJECTION_RULES) {
    if (rule.pattern.test(text)) {
      reasons.push(rule.reason);
    }
  }

  return {
    flagged: reasons.length > 0,
    reasons,
  };
}
