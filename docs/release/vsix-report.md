# SolanaPilot VSIX Packaging & Artifact Audit Report

- **Date (UTC)**: 2026-11-09 09:06
- **Package Artifact**: `solanapilot-1.0.0.vsix`
- **Compressed Package Size**: 451.84 KB
- **Packaging Tool**: `@vscode/vsce` (via `npx @vscode/vsce package --no-dependencies`)
- **Git Status**: Git-ignored via `*.vsix` in `.gitignore`
- **Publication Status**: NOT PUBLISHED (Compliant with `Agent.md` Hard Rule 5)

---

## 1. Package File Manifest

The generated VSIX archive contains exactly 10 files:

```
solanapilot-1.0.0.vsix
├── [Content_Types].xml
├── extension.vsixmanifest
└── extension/
    ├── LICENSE.txt               (1.06 KB)
    ├── changelog.md              (4.08 KB)
    ├── package.json              (7.26 KB)
    ├── readme.md                 (6.14 KB)
    ├── assets/
    │   └── icon.png              (SolanaPilot Extension Icon)
    ├── media/
    │   ├── chat.css              (12.40 KB)
    │   └── chat.js               (10.53 KB)
    └── out/
        └── extension.js          (1.64 MB, esbuild bundled & minified)
```

---

## 2. Exclusion Verification Checklist

All exclusions configured in `.vscodeignore` were audited against the packaged archive:

| Exclusion Category | Verification Rule | Audit Result | Status |
|---|---|---|---|
| **Secret Material** | No `.env*`, `*keypair*.json`, `id.json`, `*.pem` | **0 secrets packaged** | **PASS** |
| **Source Maps** | No `**/*.map` files | **0 maps packaged** | **PASS** |
| **Test Suites** | No `**/*.test.*`, `tests/**`, or test fixtures | **0 tests packaged** | **PASS** |
| **Web Explorer** | No `web-explorer/**` Next.js source or node_modules | **0 explorer files packaged** | **PASS** |
| **Contracts & Build**| No `programs/**`, `target/**`, `.anchor/**`, `ci/**` | **0 contract artifacts packaged** | **PASS** |
| **TypeScript Source**| No `src/**` or unbundled `.ts` files | **0 source .ts packaged** | **PASS** |
| **Operational Docs** | No `docs/**`, `Agent.md`, `taskslist.md`, `checkup.md` | **0 internal docs packaged** | **PASS** |
| **Branding Icon** | `assets/icon.png` included | **Icon verified present** | **PASS** |

---

## 3. Bundle Characteristics

- **Runtime Target**: Node 18+ (CJS format)
- **External Dependencies**: `vscode` (provided by VS Code Extension Host runtime)
- **Bundled Dependencies**:
  - `esbuild` bundles core logic, Zod validation schemas, `@google/genai` SDK, and template assets into a single minified entry point (`out/extension.js`).
  - Total package archive size is **451.84 KB**, well below typical marketplace extension size limits (< 50 MB).

