"use client";

import React, { useEffect, useState } from "react";
import { formatSiwsMessage, type SiwsMessageData } from "@/lib/siws";

export interface WalletProviderOption {
  name: string;
  iconName: string;
  isInstalled: boolean;
  adapterKey: "phantom" | "solflare" | "backpack";
}

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (address: string) => void;
}

interface SolanaProvider {
  publicKey?: { toBase58: () => string; toBytes: () => Uint8Array };
  connect: () => Promise<{ publicKey: { toBase58: () => string } }>;
  signMessage: (message: Uint8Array, encoding?: string) => Promise<{ signature: Uint8Array }>;
}

function getProvider(key: "phantom" | "solflare" | "backpack"): SolanaProvider | null {
  if (typeof window === "undefined") return null;

  const win = window as unknown as {
    phantom?: { solana?: SolanaProvider };
    solflare?: SolanaProvider;
    backpack?: SolanaProvider;
    solana?: SolanaProvider;
  };

  if (key === "phantom") {
    return win.phantom?.solana ?? (win.solana ?? null);
  }
  if (key === "solflare") {
    return win.solflare ?? null;
  }
  if (key === "backpack") {
    return win.backpack ?? null;
  }
  return null;
}

export function WalletModal({ isOpen, onClose, onSuccess }: WalletModalProps) {
  const [wallets, setWallets] = useState<WalletProviderOption[]>([]);
  const [status, setStatus] = useState<"idle" | "connecting" | "signing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const win = window as unknown as {
      phantom?: { solana?: unknown };
      solflare?: unknown;
      backpack?: unknown;
      solana?: unknown;
    };

    setWallets([
      {
        name: "Phantom",
        iconName: "P",
        isInstalled: !!(win.phantom?.solana || win.solana),
        adapterKey: "phantom",
      },
      {
        name: "Solflare",
        iconName: "S",
        isInstalled: !!win.solflare,
        adapterKey: "solflare",
      },
      {
        name: "Backpack",
        iconName: "B",
        isInstalled: !!win.backpack,
        adapterKey: "backpack",
      },
    ]);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleConnectAndSign(walletKey: "phantom" | "solflare" | "backpack") {
    setStatus("connecting");
    setErrorMessage(null);

    const provider = getProvider(walletKey);
    if (!provider) {
      setStatus("error");
      setErrorMessage(`${walletKey} wallet is not installed in this browser.`);
      return;
    }

    try {
      // 1. Connect wallet
      const connection = await provider.connect();
      const address = connection.publicKey.toBase58();

      // 2. Fetch fresh single-use nonce
      setStatus("signing");
      const nonceRes = await fetch("/api/auth/nonce");
      if (!nonceRes.ok) {
        throw new Error("Failed to obtain authentication nonce from server.");
      }
      const { nonce, expiresAt } = await nonceRes.json();

      // 3. Format SIWS message
      const domain = window.location.host;
      const uri = window.location.origin;
      const now = new Date();

      const messageData: SiwsMessageData = {
        domain,
        address,
        statement: "Sign in to SolanaPilot Explorer with your Solana account.",
        uri,
        version: "1",
        nonce,
        issuedAt: now.toISOString(),
        expirationTime: expiresAt,
      };

      const messageText = formatSiwsMessage(messageData);
      const encodedMessage = new TextEncoder().encode(messageText);

      // 4. Request cryptographic signature from wallet
      const signResult = await provider.signMessage(encodedMessage, "utf8");
      
      // Dynamic import bs58 for base58 string serialization
      const bs58 = (await import("bs58")).default;
      const signatureBase58 = bs58.encode(signResult.signature);

      // 5. Submit credentials to Auth.js callback
      const authRes = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          message: messageText,
          signature: signatureBase58,
        }),
      });

      if (!authRes.ok) {
        throw new Error("Authentication failed during server signature verification.");
      }

      setStatus("success");
      if (onSuccess) {
        onSuccess(address);
      }
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to sign in with Solana.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm p-6 space-y-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--fg-default)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
          <h2 id="wallet-modal-title" className="text-base font-semibold">
            Connect Solana Wallet
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg-default)] rounded transition-colors"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-[var(--fg-muted)] leading-relaxed">
          Sign-In with Solana (SIWS) authenticates using a cryptographically signed message. No transactions or funds are spent.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="p-2 text-xs text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded"
          >
            {errorMessage}
          </div>
        )}

        <div className="space-y-2">
          {wallets.map((wallet) => (
            <button
              key={wallet.name}
              type="button"
              disabled={status === "connecting" || status === "signing"}
              onClick={() => handleConnectAndSign(wallet.adapterKey)}
              className="w-full flex items-center justify-between p-3 rounded border border-[var(--border)] hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 flex items-center justify-center rounded bg-[var(--bg-elevated)] font-mono text-xs font-bold text-[var(--accent)]">
                  {wallet.iconName}
                </span>
                <span className="text-sm font-medium">{wallet.name}</span>
              </div>
              <span className="text-xs text-[var(--fg-muted)]">
                {wallet.isInstalled ? "Detected" : "Not detected"}
              </span>
            </button>
          ))}
        </div>

        {status === "signing" && (
          <div className="p-3 text-center text-xs text-[var(--accent)] bg-[var(--accent)]/10 rounded border border-[var(--accent)]/20">
            Waiting for wallet signature approval...
          </div>
        )}

        {status === "success" && (
          <div className="p-3 text-center text-xs text-[var(--success)] bg-[var(--success)]/10 rounded border border-[var(--success)]/20">
            ✓ Signed in successfully!
          </div>
        )}
      </div>
    </div>
  );
}

