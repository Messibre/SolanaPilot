"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ProgramEntry } from "../lib/mockRegistry";
import { MOCK_PROGRAMS } from "../lib/mockRegistry";
import styles from "./page.module.css";

const REGISTRY_PROGRAM_ID =
  "Xo7TcdZwXZwU2S4em9r8Gn1L5L9ppmkqFLBpCXcuSPs";

const USE_LIVE_REGISTRY =
  process.env.NEXT_PUBLIC_REGISTRY_LIVE === "true";

type SortKey = "recent" | "deployments" | "instructions" | "name";

function IconExternal({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconLayers({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

export default function Home() {
  const [programs, setPrograms] = useState<ProgramEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [online, setOnline] = useState(true);
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadMock = async () => {
      setLoading(true);
      setError(null);
      await new Promise((r) => setTimeout(r, 420));
      if (!mounted) return;
      setPrograms(MOCK_PROGRAMS);
      setLoading(false);
    };

    const loadLive = async (opts?: { signal?: AbortSignal }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const signal = opts?.signal ?? controller.signal;

      try {
        setLoading(true);
        const res = await fetch("/api/programs", {
          cache: "no-store",
          signal,
        });
        const data = (await res.json()) as {
          programs?: ProgramEntry[];
          error?: string;
        };

        if (!mounted) return;

        if (!res.ok) {
          setPrograms([]);
          setError(
            data.error ||
              "Failed to load registry from devnet. Please try again.",
          );
          return;
        }

        setPrograms(Array.isArray(data.programs) ? data.programs : []);
        setError(data.error ?? null);
      } catch (err) {
        if (!mounted) return;
        const msg =
          err instanceof DOMException && err.name === "AbortError"
            ? "Request timed out. Please try again."
            : "Failed to load registry. Please try again.";
        setError(msg);
        setPrograms([]);
      } finally {
        clearTimeout(timeout);
        if (mounted) setLoading(false);
      }
    };

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (USE_LIVE_REGISTRY) {
      const controller = new AbortController();
      void loadLive({ signal: controller.signal });
      const interval = setInterval(
        () => void loadLive({ signal: controller.signal }),
        30000,
      );
      return () => {
        mounted = false;
        controller.abort();
        clearInterval(interval);
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    void loadMock();
    return () => {
      mounted = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const totals = useMemo(() => {
    const deployments = programs.reduce(
      (n, p) => n + (p.deploymentCount || 0),
      0,
    );
    const instructions = programs.reduce(
      (n, p) => n + (p.instructionCount || 0),
      0,
    );
    return { deployments, instructions };
  }, [programs]);

  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const visiblePrograms = useMemo(() => {
    const filtered = deferredQuery
      ? programs.filter((p) => {
          const hay = `${p.programName} ${p.description} ${p.creator} ${p.programId}`.toLowerCase();
          return hay.includes(deferredQuery);
        })
      : programs.slice();

    filtered.sort((a, b) => {
      switch (sortKey) {
        case "deployments":
          return (b.deploymentCount ?? 0) - (a.deploymentCount ?? 0);
        case "instructions":
          return (b.instructionCount ?? 0) - (a.instructionCount ?? 0);
        case "name":
          return a.programName.localeCompare(b.programName);
        case "recent":
        default:
          return (b.lastUpdated ?? 0) - (a.lastUpdated ?? 0);
      }
    });

    return filtered;
  }, [deferredQuery, programs, sortKey]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  };

  return (
    <div className={styles.root}>
      <div className={styles.ambient} aria-hidden />
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerLead}>
            <p className={styles.eyebrow}>SolanaPilot</p>
            <h1 className={styles.title}>Registry explorer</h1>
            <p className={styles.subtitle}>
              Browse programs registered from the VS Code extension — metadata
              and deployment activity on Solana devnet.
            </p>
          </div>
          <div className={styles.statGrid}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{programs.length}</div>
              <div className={styles.statLabel}>Programs</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{totals.deployments}</div>
              <div className={styles.statLabel}>Total deployments</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{totals.instructions}</div>
              <div className={styles.statLabel}>Instructions (sum)</div>
            </div>
          </div>
        </header>

        <main
          ref={(el) => {
            mainRef.current = el;
          }}
          id="main-content"
          tabIndex={-1}
          className={styles.main}
        >
          <div className={styles.controls} role="search">
            <div className={styles.searchWrap}>
              <label className={styles.srOnly} htmlFor="registry-search">
                Search registry
              </label>
              <input
                id="registry-search"
                className={styles.searchInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, description, creator, or program id…"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className={styles.sortWrap}>
              <label className={styles.srOnly} htmlFor="registry-sort">
                Sort results
              </label>
              <select
                id="registry-sort"
                className={styles.sortSelect}
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="recent">Most recent</option>
                <option value="deployments">Most deployments</option>
                <option value="instructions">Most instructions</option>
                <option value="name">Name (A–Z)</option>
              </select>
            </div>

            {USE_LIVE_REGISTRY && (
              <div
                className={`${styles.netPill} ${
                  online ? styles.netOk : styles.netBad
                }`}
                aria-live="polite"
                aria-atomic="true"
              >
                {online ? "Online" : "Offline"}
              </div>
            )}
          </div>

          <div className={styles.resultsMeta} aria-live="polite" aria-atomic="true">
            {loading
              ? "Loading programs…"
              : `${visiblePrograms.length} result${visiblePrograms.length === 1 ? "" : "s"}`}
          </div>

          {loading && (
            <div className={styles.loading}>
              <div className={styles.loader} />
              <p className={styles.loadingText}>Loading registry…</p>
            </div>
          )}

          {error && !loading && (
            <div className={styles.errorBox} role="alert">
              <div className={styles.errorText}>{error}</div>
              {USE_LIVE_REGISTRY && (
                <button
                  type="button"
                  className={styles.retryBtn}
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                    void fetch("/api/programs", { cache: "no-store" })
                      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
                      .then(({ ok, j }) => {
                        if (!ok) throw new Error(j?.error || "Failed to load");
                        setPrograms(Array.isArray(j?.programs) ? j.programs : []);
                      })
                      .catch(() => setError("Failed to load registry. Please try again."))
                      .finally(() => setLoading(false));
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {!loading && visiblePrograms.length === 0 && !error && (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>
                {query.trim() ? "No matches" : "No programs yet"}
              </p>
              <p className={styles.emptyHint}>
                {query.trim()
                  ? "Try a different search term, or clear your search."
                  : "Generate and register a program with the SolanaPilot extension to see it listed here."}
              </p>
            </div>
          )}

          {!loading && visiblePrograms.length > 0 && (
            <ul className={styles.list}>
              {visiblePrograms.map((program) => (
                <li key={program.publicKey} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div className={styles.cardTitleRow}>
                      <h2 className={styles.cardTitle}>
                        {program.programName}
                      </h2>
                      <span className={styles.versionPill}>
                        v{program.generatorVersion}
                      </span>
                    </div>
                    <p className={styles.cardDescription}>
                      {program.description}
                    </p>
                    <div className={styles.programIdRow}>
                      <span className={styles.programIdLabel}>Program ID</span>
                      <code className={styles.programId}>
                        {formatAddress(program.programId)}
                      </code>
                    </div>
                  </div>

                  <div className={styles.metaGrid}>
                    <div className={styles.metaCell}>
                      <div className={styles.metaLabel}>Instructions</div>
                      <div className={styles.metaValue}>
                        {program.instructionCount}
                      </div>
                    </div>
                    <div className={styles.metaCell}>
                      <div className={styles.metaLabel}>Deployments</div>
                      <div className={`${styles.metaValue} ${styles.metaAccent}`}>
                        {program.deploymentCount}
                      </div>
                    </div>
                    <div className={styles.metaCell}>
                      <div className={styles.metaLabel}>Creator</div>
                      <div className={`${styles.metaValue} ${styles.mono}`}>
                        {formatAddress(program.creator)}
                      </div>
                    </div>
                    <div className={styles.metaCell}>
                      <div className={styles.metaLabel}>Registered</div>
                      <div className={styles.metaValue}>
                        {formatDate(program.registeredAt)}
                      </div>
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <a
                      href={`https://explorer.solana.com/address/${program.programId}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.btn} ${styles.btnPrimary}`}
                    >
                      <IconExternal />
                      Program on Explorer
                    </a>
                    <a
                      href={`https://explorer.solana.com/address/${program.publicKey}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.btn} ${styles.btnSecondary}`}
                    >
                      <IconLayers />
                      Registry entry
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </main>

        <footer className={styles.footer}>
          <div className={styles.footerRow}>
            <span className={styles.footerBrand}>SolanaPilot registry</span>
            <span className={styles.footerSep}>·</span>
            <span>Anchor + Solana devnet</span>
          </div>
          <div className={styles.footerMeta}>
            Registry program{" "}
            <code className={styles.code}>{REGISTRY_PROGRAM_ID}</code>
          </div>
        </footer>
      </div>
    </div>
  );
}
