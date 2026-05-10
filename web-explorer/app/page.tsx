"use client";

import { useEffect, useState } from "react";

const REGISTRY_PROGRAM_ID = "SolanaPilot1111111111111111111111111111111";

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
    fetchPrograms();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPrograms, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPrograms = async () => {
    try {
      setLoading(true);

      // For now, we'll show a placeholder since the program is newly deployed
      // In production, this would fetch from the Solana blockchain
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

      setPrograms(mockPrograms);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch programs:", err);
      setError("Failed to load registry. Please try again.");
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  };

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
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold">🚀 SolanaPilot Registry</h1>
              <p className="text-gray-400 mt-2">
                Discover AI-generated Solana programs on devnet
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-400">
                {programs.length}
              </div>
              <div className="text-gray-400">Programs Registered</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-purple-400"></div>
            <p className="mt-4 text-gray-400">Loading registry...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-200">
            {error}
          </div>
        )}

        {!loading && programs.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg mb-4">
              No programs registered yet. Be the first to register!
            </p>
            <p className="text-gray-500 text-sm">
              Generate a program with SolanaPilot extension and register it
              here.
            </p>
          </div>
        )}

        {!loading && programs.length > 0 && (
          <div className="grid gap-6">
            {programs.map((program) => (
              <div
                key={program.publicKey}
                className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-purple-500 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                      {program.programName}
                    </h2>
                    <p className="text-gray-300">{program.description}</p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-purple-400 font-semibold">
                      {program.generatorVersion}
                    </div>
                    <div className="text-gray-500">SolanaPilot v</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 py-4 border-t border-b border-gray-700">
                  <div>
                    <div className="text-gray-400 text-sm">Instructions</div>
                    <div className="text-xl font-bold text-white">
                      {program.instructionCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-sm">Deployments</div>
                    <div className="text-xl font-bold text-green-400">
                      {program.deploymentCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-sm">Creator</div>
                    <div className="text-sm font-mono text-gray-300">
                      {formatAddress(program.creator)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-sm">Registered</div>
                    <div className="text-sm text-gray-300">
                      {formatDate(program.registeredAt)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <a
                    href={`https://explorer.solana.com/address/${program.programId}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors"
                  >
                    🔍 View on Explorer
                  </a>
                  <a
                    href={`https://explorer.solana.com/address/${program.publicKey}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
                  >
                    📋 View Entry
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-700 bg-gray-900 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-400">
          <p>SolanaPilot Registry — Powered by Anchor + Solana</p>
          <p className="text-sm mt-2">
            Program ID:{" "}
            <code className="text-gray-500 font-mono text-xs">
              {REGISTRY_PROGRAM_ID}
            </code>
          </p>
        </div>
      </footer>
    </div>
  );
}
