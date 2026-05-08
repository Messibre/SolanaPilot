// Template strings for React frontend generation
// Used by aiClient.ts generateFrontend() function

export const FRONTEND_REACT_TEMPLATE = `
import { FC } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program } from '@project-serum/anchor';
import { useWallet } from '@solana/wallet-adapter-react';

interface DappProps {
  programId: PublicKey;
}

export const Dapp: FC<DappProps> = ({ programId }) => {
  const wallet = useWallet();

  if (!wallet.connected) {
    return <div>Please connect your wallet</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Solana dApp</h1>
      <p>Program ID: {programId.toBase58()}</p>
    </div>
  );
};
`;

export const VITE_CONFIG_TEMPLATE = `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  }
})
`;

export const PACKAGE_JSON_TEMPLATE = `
{
  "name": "solana-dapp",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@coral-xyz/anchor": "^0.30.0",
    "@solana/web3.js": "^1.93.0",
    "@solana/wallet-adapter-react": "^0.15.0",
    "@solana/wallet-adapter-react-ui": "^0.9.0",
    "@solana/wallet-adapter-phantom": "^0.9.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
`;
