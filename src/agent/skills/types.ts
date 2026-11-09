/**
 * Type definitions for modular skills in SolanaPilot.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

export interface Skill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly triggerKeywords: readonly string[];
  readonly relevantStages?: readonly string[];
  readonly workflow: string;
  readonly expectedOutputSchema: string;
  readonly failureRules: readonly string[];
  readonly securityBoundary: readonly string[];
  readonly content: string;
}

export interface LoadedSkillsResult {
  basePrompt: string;
  loadedSkills: Skill[];
  fullPrompt: string;
  tokenEstimate: number;
}

