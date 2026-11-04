import type { ConversationEntry } from "./types";

export const DEFAULT_MAX_HISTORY_MESSAGES = 10;

export class HistoryStore {
  private entries: ConversationEntry[] = [];
  private readonly maxEntriesProvider: () => number;

  constructor(maxEntries?: number | (() => number)) {
    if (typeof maxEntries === "function") {
      this.maxEntriesProvider = maxEntries;
    } else if (typeof maxEntries === "number" && maxEntries > 0) {
      this.maxEntriesProvider = () => maxEntries;
    } else {
      this.maxEntriesProvider = () => DEFAULT_MAX_HISTORY_MESSAGES;
    }
  }

  public push(entry: ConversationEntry): void {
    this.entries.push(entry);
    const limit = Math.max(1, this.maxEntriesProvider());
    if (this.entries.length > limit) {
      this.entries = this.entries.slice(-limit);
    }
  }

  public clear(): void {
    this.entries = [];
  }

  public getEntries(): readonly ConversationEntry[] {
    return this.entries;
  }

  public formatForPrompt(): string {
    const limit = Math.max(1, this.maxEntriesProvider());
    return this.entries
      .slice(-limit)
      .map(
        (entry) =>
          `${entry.role === "user" ? "User" : "Assistant"} (${entry.mode}): ${entry.content}`,
      )
      .join("\n\n");
  }
}

