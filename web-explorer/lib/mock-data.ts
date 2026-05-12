export interface Program {
  programId: string;
  programName: string;
  description: string;
  instructionCount: number;
  deploymentCount: number;
  creator: string;
  registeredAt: string;
  version: string;
  registryPda: string;
  category: string;
  lastDeployed: string;
}

export const MOCK_PROGRAMS: Program[] = [
  {
    programId: "8xzX1GvCKmV2hvDqQFykWSfLhMxHpQqYz3TbW9kF7JdR",
    programName: "community_polls",
    description: "On-chain voting with quadratic weights, proposal lifecycle management, and real-time result tallying. Suitable for DAOs and community decisions.",
    instructionCount: 3,
    deploymentCount: 2,
    creator: "J6rXkKzCqe5nUx3NCDw1pRt8mZgYvqFSWoh7G4b2XjLd",
    registeredAt: "2026-05-10T14:30:00Z",
    version: "v1.0.0",
    registryPda: "HeGKoLyVNrdS5x5UGGV1ALBqKRfkZw5BMHoF2PqR8Jb5",
    category: "Governance",
    lastDeployed: "2026-05-11T08:15:00Z"
  },
  {
    programId: "F3xQn9yZiTbW5oRk2vDc7mJ8pLhUXg4sYa6eN1dVtMwC",
    programName: "spl_stream_vault",
    description: "Time-locked token streaming with cliff and vesting schedules. Supports cancelation with penalty and multi-recipient streams.",
    instructionCount: 2,
    deploymentCount: 1,
    creator: "Ht5cRqo7JkXm2YwvN3zLp9Bs4Gf6Dk8Uh1WxEyVcAaSe",
    registeredAt: "2026-05-09T09:20:00Z",
    version: "v1.0.0",
    registryPda: "CjRhWoKzUmNq3pXy2dFv8Tc1bGk5Jm7Ls4Ha9EwQxDtA",
    category: "DeFi",
    lastDeployed: "2026-05-10T21:45:00Z"
  },
  {
    programId: "9LpKm2JxH4sTfBvR3qCwN5dYzA7XeG8WuT1oLk6FjMv",
    programName: "micro_lend_pool",
    description: "Peer-to-pool micro-lending with collateralized debt model, dynamic interest curves, and liquidation mechanism.",
    instructionCount: 2,
    deploymentCount: 3,
    creator: "Kj2PvR9oUw5XyBc3Nq7LtGh1ZzFd8Wm4JkSp6AxVeYn",
    registeredAt: "2026-05-08T18:45:00Z",
    version: "v1.0.0",
    registryPda: "DpFq3JvWx6Hz9LkN1MbUy2Tc5Ro8Xs4Ge7BwAqKfYm",
    category: "DeFi",
    lastDeployed: "2026-05-11T12:30:00Z"
  },
  {
    programId: "DwH7rVx4KqL9zPc6TfBj2Mn5Ro3XyS8Wg1UpNkAeFv",
    programName: "nft_escrow_market",
    description: "Trustless NFT escrow marketplace: sellers lock assets, buyers deposit, contract releases upon confirmation. Includes royalties enforcement.",
    instructionCount: 3,
    deploymentCount: 4,
    creator: "Mn9LqXyBb2JfRw4St7Kc3Gh1UvNp6Zm8Wo5TkDzAeF",
    registeredAt: "2026-05-07T11:10:00Z",
    version: "v1.0.0",
    registryPda: "EiXvBt3Qo7YrLm8Kc2WzNq1Fj5Sd6Hg4Uw9AkpTnRp",
    category: "NFT",
    lastDeployed: "2026-05-10T17:00:00Z"
  },
  {
    programId: "5TqW6XfBz1LkNv2Rp3Jh8Cm9Ys4GxDw5Hk7PnVoLuAa",
    programName: "dao_proposal_hub",
    description: "Minimal DAO framework: create proposal, cast token-weighted vote, execute after quorum. Built for small teams and hackathons.",
    instructionCount: 3,
    deploymentCount: 7,
    creator: "Ps2RvNq6Xb9Hj5YwLf3Km8Gc1VzTk7Wp4DoUxAyBeMn",
    registeredAt: "2026-04-28T22:05:00Z",
    version: "v0.9.2",
    registryPda: "FgHq3Jm2Vx5Yk9Lp1Rn7Wc4Ts6Bw8UzNoAeXfGyDvK",
    category: "Governance",
    lastDeployed: "2026-05-11T10:10:00Z"
  },
  {
    programId: "7UjYx3Wo9RpBq2KvNc5LtFg7Hz8Sk1Dm4XnVeAaFwG",
    programName: "token_swap_amm",
    description: "Constant-product AMM with concentrated liquidity ranges, multiple fee tiers, and single-sided liquidity provision. Optimized for low compute.",
    instructionCount: 4,
    deploymentCount: 5,
    creator: "Lq1XzWo5Tp8Nc3Bj9Kv6Rm2Yg7Hf4UwDkSaVnEoAp",
    registeredAt: "2026-04-25T08:30:00Z",
    version: "v1.2.0",
    registryPda: "GyNp3Rt7Lb2Xc9Km1Vf5Qw4Hz6Jj8SvDaFkUoYqWe",
    category: "DeFi",
    lastDeployed: "2026-05-10T15:40:00Z"
  },
  {
    programId: "2XhN4Bw7ZqJp9Vk1Rc3LtYg5Hf8Km6Uj2WoDpTeAaS",
    programName: "staking_rewards",
    description: "Flexible staking pool with dynamic yield, lock-up periods, early withdraw penalties, and auto-compounding rewards.",
    instructionCount: 3,
    deploymentCount: 3,
    creator: "Vn5Km3Xc7Yt1Bp9Jq2Lw6Rf8Hg4WdSzUkNoFaAeGv",
    registeredAt: "2026-05-05T16:20:00Z",
    version: "v1.0.0",
    registryPda: "HpFx9Rq2Wd6Lk3Zc8Nt4Ym7Vo1Bj5UwKbGaSeXfD",
    category: "DeFi",
    lastDeployed: "2026-05-11T09:00:00Z"
  },
  {
    programId: "6BmXf2Wz8KjHq1Lk9Nw3Vp5Rc7Ty4GdUoJsPvAaSeF",
    programName: "multisig_wallet",
    description: "Threshold-based multisig with expiration timelocks, multiple signers, and owner rotation. Supports execute-once and recurring transactions.",
    instructionCount: 5,
    deploymentCount: 9,
    creator: "Ud3Yp8Rc6Kq1Lj9Bw5Nm7Vx2Hf4TzWgSkDoGaFeAv",
    registeredAt: "2026-04-20T12:45:00Z",
    version: "v2.1.0",
    registryPda: "JmXt7Qw4Ls5Kf2Nv9Rc3Yh1Bg6Wy8UzPkTpDfAoG",
    category: "Utility",
    lastDeployed: "2026-05-10T14:20:00Z"
  },
  {
    programId: "1AoFvGq7Xv2Bk5Lj9Hw6Np3Yy8Cx1Rm4TfUzWdKaEsV",
    programName: "prediction_market",
    description: "Binary prediction market with AMM pricing, oracle resolution, and liquidity rewards. Buy/sell outcome shares with auto-settlement.",
    instructionCount: 4,
    deploymentCount: 2,
    creator: "Qw2FkLc7Yb3Hn5Tp1Vm9Jx6Rg8Ud4WoAsKzBvNeGa",
    registeredAt: "2026-05-02T20:15:00Z",
    version: "v0.8.0",
    registryPda: "KcVx4Hp6Rt2Lm9Yq1Wn5Fj7Tb3Zd8UoGkSeAwXfDv",
    category: "Prediction",
    lastDeployed: "2026-05-10T19:50:00Z"
  },
  {
    programId: "4TcYz2Xg9QkNv3Jp1Lm8Rf5Bj7Hw6DtUkToVeSaAoF",
    programName: "name_registry",
    description: "Blockchain domain registry with yearly renewal fees, subdomain support, and transfers. Compatible with SNS lookups.",
    instructionCount: 3,
    deploymentCount: 1,
    creator: "Ny3Wp6Rx8Gk1Lf5Jq9Bm2Vz7Tc4HwUdSoKvAfFeXa",
    registeredAt: "2026-05-11T02:40:00Z",
    version: "v1.0.0",
    registryPda: "LoYm5Vp2Tb8Nq4Hf1Wc7Rj3Xz6Gk9UwDdSaKeJvFp",
    category: "Naming",
    lastDeployed: "2026-05-11T03:05:00Z"
  }
];

// Helper to get computed stats
export function getRegistryStats(programs: Program[]) {
  const totalPrograms = programs.length;
  const totalDeployments = programs.reduce((sum, p) => sum + p.deploymentCount, 0);
  const totalInstructions = programs.reduce((sum, p) => sum + p.instructionCount, 0);
  return { totalPrograms, totalDeployments, totalInstructions };
}

// Helper to format relative time
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Helper to truncate address
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// Solana Explorer URL helper
export function getSolanaExplorerUrl(address: string, type: 'address' | 'tx' = 'address'): string {
  return `https://explorer.solana.com/${type}/${address}?cluster=devnet`;
}

// Category colors
export const categoryColors: Record<string, { bg: string; text: string }> = {
  Governance: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  DeFi: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  NFT: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  Utility: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  Prediction: { bg: 'bg-pink-500/20', text: 'text-pink-400' },
  Naming: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
};
