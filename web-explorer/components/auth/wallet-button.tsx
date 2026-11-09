"use client";

import React, { useState } from "react";
import { WalletModal } from "./wallet-modal";

interface WalletButtonProps {
  className?: string;
}

export function WalletButton({ className }: WalletButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);

  function formatAddress(addr: string) {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={
          className ??
          "px-3 py-1.5 text-xs font-mono font-medium rounded border border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg-default)] hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-colors"
        }
      >
        {connectedAddress ? formatAddress(connectedAddress) : "Sign In with Solana"}
      </button>

      <WalletModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(address) => setConnectedAddress(address)}
      />
    </>
  );
}

