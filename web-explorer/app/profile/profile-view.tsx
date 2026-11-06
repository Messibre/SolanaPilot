"use client";

import React, { useEffect, useState } from "react";
import { User, Wallet, Github, Trash2, Plus, ShieldCheck } from "lucide-react";
import { WalletModal } from "@/components/auth/wallet-modal";

interface IdentityItem {
  id: string;
  provider: string;
  providerAccountId: string;
}

export function ProfileView() {
  const [identities, setIdentities] = useState<IdentityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  async function loadIdentities() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/account/identities");
      if (res.status === 401) {
        setIdentities([]);
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to load linked identities.");
      }
      const data = await res.json();
      setIdentities(data.identities ?? []);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load profile.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadIdentities();
  }, []);

  async function handleUnlink(provider: string, providerAccountId: string) {
    setErrorMessage(null);
    setActionMessage(null);

    if (identities.length <= 1) {
      setErrorMessage("Cannot unlink your only remaining sign-in identity.");
      return;
    }

    try {
      const res = await fetch("/api/account/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, providerAccountId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to unlink identity.");
      }

      setActionMessage(`Successfully unlinked ${provider} identity.`);
      await loadIdentities();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unlink failed.");
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="p-6 rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
        <div className="flex items-center gap-4 pb-6 border-b border-[var(--border)]">
          <div className="w-12 h-12 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)]">
            <User className="size-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--fg-default)]">
              Developer Profile & Identities
            </h1>
            <p className="text-xs text-[var(--fg-muted)]">
              Manage your linked authentication providers. Link both Solana and GitHub to verify program authorship.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 p-3 text-xs text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded"
          >
            {errorMessage}
          </div>
        )}

        {actionMessage && (
          <div
            role="status"
            className="mt-4 p-3 text-xs text-[var(--success)] bg-[var(--success)]/10 border border-[var(--success)]/20 rounded"
          >
            {actionMessage}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--fg-default)] flex items-center gap-2">
              <ShieldCheck className="size-4 text-[var(--accent)]" />
              Linked Sign-In Methods ({identities.length})
            </h2>
            <button
              type="button"
              onClick={() => setIsWalletModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--accent)] text-[var(--fg-default)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-colors"
            >
              <Plus className="size-3.5" />
              Link Solana Wallet
            </button>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-xs text-[var(--fg-muted)]">
              Loading identities...
            </div>
          ) : identities.length === 0 ? (
            <div className="py-8 text-center rounded border border-dashed border-[var(--border)] p-6 space-y-3">
              <p className="text-xs text-[var(--fg-muted)]">
                No identities linked yet. Connect a Solana wallet or sign in with GitHub to link your account.
              </p>
              <button
                type="button"
                onClick={() => setIsWalletModalOpen(true)}
                className="px-4 py-2 text-xs font-medium rounded bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
              >
                Sign In with Solana
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-md">
              {identities.map((identity) => (
                <div
                  key={identity.id}
                  className="flex items-center justify-between p-3 bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="p-2 rounded bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--fg-default)]">
                      {identity.provider === "github" ? (
                        <Github className="size-4" />
                      ) : (
                        <Wallet className="size-4 text-[var(--accent)]" />
                      )}
                    </span>
                    <div>
                      <div className="text-xs font-semibold capitalize text-[var(--fg-default)]">
                        {identity.provider}
                      </div>
                      <div className="font-mono text-xs text-[var(--fg-muted)]">
                        {identity.provider === "solana"
                          ? `${identity.providerAccountId.slice(0, 6)}...${identity.providerAccountId.slice(-6)}`
                          : identity.providerAccountId}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={identities.length <= 1}
                    onClick={() => handleUnlink(identity.provider, identity.providerAccountId)}
                    title={
                      identities.length <= 1
                        ? "Cannot unlink your only sign-in method"
                        : `Unlink ${identity.provider}`
                    }
                    className="p-1.5 text-[var(--fg-muted)] hover:text-[var(--danger)] rounded hover:bg-[var(--danger)]/10 disabled:opacity-30 disabled:hover:text-[var(--fg-muted)] disabled:hover:bg-transparent transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onSuccess={async () => {
          setActionMessage("Wallet successfully authenticated!");
          await loadIdentities();
        }}
      />
    </div>
  );
}
