# Baseline Report

Captured on: 2026-11-03 08:25 UTC
Branch: feat/refactor

## 1. Extension Root (`/`)

### `npm run typecheck`
- **Exit code**: 0
- **Total failures**: 0
- **Status**: Clean

### `npm run lint` (`eslint src --ext ts`)
- **Exit code**: 0
- **Total issues**: 5 warnings (0 errors)
- **Messages**:
  1. `src/programGenerator.ts:11:10` - `'RegistryClient' is defined but never used (@typescript-eslint/no-unused-vars)`
  2. `src/programGenerator.ts:224:15` - `'nextChar' is assigned a value but never used (@typescript-eslint/no-unused-vars)`
  3. `src/programGenerator.ts:498:16` - `'offerRegistryRegistration' is defined but never used (@typescript-eslint/no-unused-vars)`
  4. `src/registryClient.ts:137:50` - `Unexpected any. Specify a different type (@typescript-eslint/no-explicit-any)`
  5. `src/registryClient.ts:168:50` - `Unexpected any. Specify a different type (@typescript-eslint/no-explicit-any)`

---

## 2. Web Explorer (`web-explorer/`)

### `npm run lint` (`eslint .`)
- **Exit code**: 1
- **Total failures**: 1 error (0 warnings)
- **Messages**:
  1. `components/registry/registry-explorer.tsx:10:10` - `'Button' is defined but never used (@typescript-eslint/no-unused-vars)`

### `npx tsc --noEmit`
- **Exit code**: 1
- **Total failures**: 3 errors
- **Messages**:
  1. `lib/solana.ts:31:10` - `error TS2352: Conversion of type '{ publicKey: PublicKey; signTransaction: () => Promise<never>; signAllTransactions: () => Promise<never>; }' to type 'Wallet' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first. Property 'payer' is missing in type '{ publicKey: PublicKey; signTransaction: () => Promise<never>; signAllTransactions: () => Promise<never>; }' but required in type 'NodeWallet'.`
  2. `lib/solana.ts:135:33` - `error TS2352: Conversion of type '{ address: string; version: string; name: string; instructions: (...)[]; accounts: (...)[]; events: (...)[]; errors: (...)[]; }' to type 'Idl' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first. Property 'metadata' is missing in type ... but required in type 'Idl'.`
  3. `lib/solana.ts:135:45` - `error TS2345: Argument of type 'PublicKey' is not assignable to parameter of type 'Provider'. Property 'connection' is missing in type 'PublicKey' but required in type 'Provider'.`
