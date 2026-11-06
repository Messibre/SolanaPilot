import bs58 from "bs58";

export interface ProgramRecord {
  programId: string;
  authority: string;
  name: string;
  description: string;
  version: string;
  createdAt: number;
  updatedAt: number;
}

export interface TtlCacheOptions {
  ttlMs: number;
  now?: () => number;
}

/**
 * Generic in-memory TTL Cache supporting fake clock injection.
 */
export class TtlCache<K, V> {
  private store = new Map<K, { value: V; expiresAt: number }>();
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options: TtlCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.now = options.now ?? (() => Date.now());
  }

  get(key: K): V | null {
    const item = this.store.get(key);
    if (!item) return null;

    if (this.now() >= item.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  set(key: K, value: V): void {
    this.store.set(key, {
      value,
      expiresAt: this.now() + this.ttlMs,
    });
  }

  clear(): void {
    this.store.clear();
  }
}

export interface ProgramsQueryParams {
  pageSize: number;
  offset: number;
  authority?: string;
  search?: string;
}

export type ParseQueryResult =
  | { ok: true; data: ProgramsQueryParams }
  | { ok: false; error: string };

function isValidSolanaPublicKey(address: string): boolean {
  try {
    const decoded = bs58.decode(address);
    return decoded.length === 32;
  } catch {
    return false;
  }
}

/**
 * Parses and strictly clamps query parameters for program listing:
 * - pageSize: clamped to [1, 50] (default 20)
 * - offset: clamped to [0, Infinity] (default 0)
 * - authority: validated as 32-byte base58 public key
 */
export function parseProgramsQuery(
  raw: Record<string, string | undefined>
): ParseQueryResult {
  let pageSize = 20;
  if (raw.pageSize !== undefined) {
    const parsed = parseInt(raw.pageSize, 10);
    if (!isNaN(parsed)) {
      pageSize = Math.min(50, Math.max(1, parsed));
    }
  }

  let offset = 0;
  if (raw.offset !== undefined) {
    const parsed = parseInt(raw.offset, 10);
    if (!isNaN(parsed)) {
      offset = Math.max(0, parsed);
    }
  }

  let authority: string | undefined;
  if (raw.authority && raw.authority.trim().length > 0) {
    const trimmed = raw.authority.trim();
    if (!isValidSolanaPublicKey(trimmed)) {
      return {
        ok: false,
        error: "Invalid authority public key: must be a valid 32-byte base58 string.",
      };
    }
    authority = trimmed;
  }

  const search = raw.search && raw.search.trim().length > 0 ? raw.search.trim() : undefined;

  return {
    ok: true,
    data: {
      pageSize,
      offset,
      authority,
      search,
    },
  };
}

/**
 * Filters a list of programs by authority and optional search string.
 */
export function filterPrograms(
  programs: ProgramRecord[],
  filter: { authority?: string; search?: string }
): ProgramRecord[] {
  return programs.filter((program) => {
    if (filter.authority && program.authority !== filter.authority) {
      return false;
    }

    if (filter.search) {
      const q = filter.search.toLowerCase();
      const matchName = program.name.toLowerCase().includes(q);
      const matchDesc = program.description.toLowerCase().includes(q);
      const matchId = program.programId.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchId) {
        return false;
      }
    }

    return true;
  });
}

// Global server-side registry cache: 30 seconds TTL
export const serverRegistryCache = new TtlCache<string, ProgramRecord[]>({
  ttlMs: 30 * 1000,
});

