"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

const REGISTRY_PROGRAM_ID = "Xo7TcdZwXZwU2S4em9r8Gn1L5L9ppmkqFLBpCXcuSPs";

interface ProgramEntry {
  publicKey: string;
  programId: string;
  programName: string;
  description: string;
  instructionCount: number;
  creator: string;
  registeredAt: number;
  lastUpdated: number;
  generatorVersion: string;
  deploymentCount: number;
}

export default function Home() {
  const [programs, setPrograms] = useState<ProgramEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchPrograms = async () => {
      try {
        setLoading(true);

        // Mock data for now — replace with real fetch when registry is deployed
        const mockPrograms: ProgramEntry[] = [
          {
            publicKey: "registered-1",
            programId: "YourFirstProgram11111111111111111111111111",
            programName: "Voting Program",
            description: "A decentralized voting program for on-chain polls",
            instructionCount: 3,
            creator: "YourWalletAddress111111111111111111111111",
            registeredAt: Math.floor(Date.now() / 1000),
            lastUpdated: Math.floor(Date.now() / 1000),
            generatorVersion: "1.0.0",
            deploymentCount: 1,
          },
        ];

        if (!mounted) return;
        setPrograms(mockPrograms);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch programs:", err);
        if (!mounted) return;
        setError("Failed to load registry. Please try again.");
        setPrograms([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchPrograms();
    const interval = setInterval(fetchPrograms, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

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
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  return (
    <div className={styles.root}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>SolanaPilot Registry</h1>
            <p className={styles.subtitle}>
              Discover AI-generated Solana programs on devnet
            </p>
          </div>
          <div className={styles.stats}>
            <div className={styles.statsNumber}>{programs.length}</div>
            <div className={styles.statsLabel}>Programs Registered</div>
          </div>
        </header>

        <main className={styles.main}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.loader} />
              <p style={{ marginTop: 12 }}>Loading registry...</p>
            </div>
          )}

          {error && (
            <div
              style={{
                background: "rgba(128,0,0,0.12)",
                padding: 12,
                borderRadius: 8,
                color: "#ffdede",
              }}
            >
              {error}
            </div>
          )}

          {!loading && programs.length === 0 && !error && (
            <div className={styles.empty}>
              <p>No programs registered yet. Be the first to register!</p>
              <p style={{ color: "#8f99a6", marginTop: 8 }}>
                Generate a program with SolanaPilot extension and register it
                here.
              </p>
            </div>
          )}

          {!loading && programs.length > 0 && (
            <div className={styles.list}>
              {programs.map((program) => (
                <div key={program.publicKey} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div>
                      <h2 className={styles.cardTitle}>
                        {program.programName}
                      </h2>
                      <p className={styles.cardDescription}>
                        {program.description}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "var(--accent)" }}>
                        {program.generatorVersion}
                      </div>
                      <div style={{ color: "#8f99a6" }}>SolanaPilot v</div>
                    </div>
                  </div>

                  <div className={styles.metaGrid}>
                    <div>
                      <div className={styles.metaLabel}>Instructions</div>
                      <div className={styles.metaValue}>
                        {program.instructionCount}
                      </div>
                    </div>
                    <div>
                      <div className={styles.metaLabel}>Deployments</div>
                      <div
                        className={styles.metaValue}
                        style={{ color: "#66f3a3" }}
                      >
                        {program.deploymentCount}
                      </div>
                    </div>
                    <div>
                      <div className={styles.metaLabel}>Creator</div>
                      <div
                        className={styles.metaValue}
                        style={{
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco",
                        }}
                      >
                        {formatAddress(program.creator)}
                      </div>
                    </div>
                    <div>
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
                      🔍 View on Explorer
                    </a>
                    <a
                      href={`https://explorer.solana.com/address/${program.publicKey}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.btn} ${styles.btnSecondary}`}
                    >
                      📋 View Entry
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        <footer className={styles.footer}>
          <div>SolanaPilot Registry — Powered by Anchor + Solana</div>
          <div style={{ marginTop: 8 }}>
            Program ID:{" "}
            <span className={styles.code}>{REGISTRY_PROGRAM_ID}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
