# 🚀 SolanaPilot Registry — Web Explorer

Browse all AI-generated Solana programs from SolanaPilot users.

## 🛠️ Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the registry.

## 📦 Deploy to Vercel

```bash
vercel
```

The explorer will fetch program entries from the on-chain registry program at:

- **Devnet Program ID:** `SolanaPilot1111111111111111111111111111111`

## 🏗️ Architecture

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS
- **Blockchain:** @solana/web3.js + @coral-xyz/anchor

The explorer queries all `ProgramEntry` accounts from the registry program and displays them in a searchable, sortable grid.
