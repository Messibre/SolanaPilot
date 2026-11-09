/**
 * Progressive disclosure skill loader for SolanaPilot.
 * Strictly adheres to Agent.md §6, §8, and §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { BASE_SYSTEM_PROMPT } from "../../ai/prompts/base";
import { anchorCoreSkill } from "./anchorCore";
import { cpiSkill } from "./cpi";
import { frontendWalletSkill } from "./frontendWallet";
import { pdaSkill } from "./pda";
import { securityChecklistSkill } from "./securityChecklist";
import { splTokenSkill } from "./splToken";
import { testingSkill } from "./testing";
import { token2022Skill } from "./token2022";
import type { LoadedSkillsResult, Skill } from "./types";

export const ALL_SKILLS: readonly Skill[] = [
  anchorCoreSkill,
  pdaSkill,
  splTokenSkill,
  token2022Skill,
  cpiSkill,
  securityChecklistSkill,
  frontendWalletSkill,
  testingSkill,
] as const;

export class SkillLoader {
  private readonly skills: readonly Skill[];

  constructor(skills: readonly Skill[] = ALL_SKILLS) {
    this.skills = skills;
  }

  public getAllSkills(): readonly Skill[] {
    return this.skills;
  }

  public getSkillById(id: string): Skill | undefined {
    return this.skills.find((s) => s.id === id);
  }

  /**
   * Generates a compact one-line summary overview of all registered skills.
   */
  public getSkillSummaries(): string {
    return this.skills
      .map((s) => `- [${s.id}] ${s.name}: ${s.description}`)
      .join("\n");
  }

  /**
   * Identifies which skills should be loaded for a user request or pipeline stage.
   */
  public findSkillsForRequest(userPrompt: string, stage?: string): Skill[] {
    const lowerPrompt = userPrompt.toLowerCase();
    const loaded: Skill[] = [];

    for (const skill of this.skills) {
      let shouldLoad = false;

      // 1. Check keyword triggers in user request
      for (const keyword of skill.triggerKeywords) {
        if (lowerPrompt.includes(keyword.toLowerCase())) {
          shouldLoad = true;
          break;
        }
      }

      // 2. Check stage relevance
      if (!shouldLoad && stage && skill.relevantStages) {
        if (skill.relevantStages.includes(stage)) {
          shouldLoad = true;
        }
      }

      if (shouldLoad) {
        loaded.push(skill);
      }
    }

    return loaded;
  }

  /**
   * Assembles a progressive disclosure system prompt combining immutable base safety rules,
   * compact skill summaries, and detailed full-text instructions for triggered skills.
   */
  public buildProgressivePrompt(options: {
    basePrompt?: string;
    userPrompt: string;
    stage?: string;
  }): LoadedSkillsResult {
    const base = options.basePrompt ?? BASE_SYSTEM_PROMPT;
    const loadedSkills = this.findSkillsForRequest(options.userPrompt, options.stage);

    const summaries = this.getSkillSummaries();

    let skillsDetailSection = "";
    if (loadedSkills.length > 0) {
      const details = loadedSkills
        .map((s) => {
          return `### SKILL: ${s.name} (${s.id})
Workflow:
${s.workflow}

Expected Output:
${s.expectedOutputSchema}

Failure Rules:
${s.failureRules.map((r) => `- ${r}`).join("\n")}

Security Boundaries:
${s.securityBoundary.map((b) => `- ${b}`).join("\n")}

Reference Content:
${s.content}`;
        })
        .join("\n\n---\n\n");

      skillsDetailSection = `\n\nACTIVE SPECIALIZED SKILLS (INJECTED FOR THIS TASK):\n${details}`;
    }

    const fullPrompt = `${base}

AVAILABLE SKILLS OVERVIEW:
${summaries}${skillsDetailSection}`;

    // Conservative token estimate: 1 token ~ 4 characters
    const tokenEstimate = Math.ceil(fullPrompt.length / 4);

    return {
      basePrompt: base,
      loadedSkills,
      fullPrompt,
      tokenEstimate,
    };
  }
}

