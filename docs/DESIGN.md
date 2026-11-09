# SolanaPilot Design System & Theming

This document outlines the design tokens, color philosophy, typography, spacing, and guidelines for the SolanaPilot web explorer and extension webview, per `Agent.md` §14.

---

## 1. Philosophy & Aesthetic

SolanaPilot is designed as a serious developer tool built with taste:
- **Calm, spacious, Solana-flavored**: Not an "AI-generated landing page".
- **Grayish and soft surfaces**: No pitch black (`#000000`) or blinding white (`#ffffff`) backdrops.
- **First-class theming**: Dark, Light, and System modes with persisted user selection and zero flash on load.
- **Strict WCAG AA conformance**: Every text and background pair reaches $\ge 4.5:1$ contrast ratio for body text and $\ge 3.0:1$ for large/UI text, automatically asserted by tests in `web-explorer/lib/contrast.test.ts`.

---

## 2. The 60 / 30 / 10 Rule

Color application follows strict proportion:
- **60% Page Background**: Soft neutral base (`--bg`).
- **30% Surfaces & Structure**: Cards, tables, sidebars, borders, muted surfaces, and text (`--surface`, `--surface-2`, `--border`, `--text`, `--text-muted`).
- **10% Solana Accent**: Used **strictly** on:
  - Primary call-to-action buttons
  - Icons signalling action or active status
  - Focus rings for keyboard accessibility
  - Active navigation indicator
  - Small status indicators

Accent color is never smeared over large page backgrounds or hero containers.

---

## 3. Design Tokens

Tokens are defined in `web-explorer/styles/tokens.css` and mapped to Tailwind CSS utilities. Components reference CSS variables or Tailwind utility classes—**never hardcoded hex colors**.

| Token | Dark Mode | Light Mode | Description / Usage |
|---|---|---|---|
| `--bg` | `#121214` | `#F4F4F6` | Page background base |
| `--surface` | `#1A1A1E` | `#FFFFFF` | Cards, panels, modals |
| `--surface-2` | `#222228` | `#EBEBEF` | Secondary panels, table zebra, hover states |
| `--border` | `#2E2E35` | `#D9D9E0` | 1px borders, dividers, inputs |
| `--text` | `#ECECEF` | `#17171A` | Primary body and heading text |
| `--text-muted` | `#9A9AA5` | `#5E5E69` | Secondary labels, descriptions, timestamps |
| `--accent` | `#9945FF` | `#7A22E0` | Solana purple accent (WCAG AA compliant) |
| `--accent-fg` | `#FFFFFF` | `#FFFFFF` | Text on top of accent buttons |
| `--success` | `#14F195` | `#0E9F65` | Success dots, confirmation badges |
| `--danger` | `#F05D6C` | `#C8303F` | Error banners, deletion actions |

---

## 4. Spacing, Radius, and Shape

### 4A. Spacing (Base 4px Scale)
Section vertical padding $\ge 64\text{px}$ on desktop. Max container width: $\sim 1120\text{px}$. Text lines $\le 70\text{ch}$.

| Variable | Value | Pixels |
|---|---|---|
| `--space-1` | `0.25rem` | 4px |
| `--space-2` | `0.5rem` | 8px |
| `--space-3` | `0.75rem` | 12px |
| `--space-4` | `1rem` | 16px |
| `--space-6` | `1.5rem` | 24px |
| `--space-8` | `2rem` | 32px |
| `--space-12` | `3rem` | 48px |
| `--space-16` | `4rem` | 64px |
| `--space-24` | `6rem` | 96px |

When unsure, add space rather than borders.

### 4B. Corner Radius & Borders
- One corner radius everywhere: `8px` (`0.5rem`).
- 1px crisp borders (`--border`) instead of drop shadows.
- At most one subtle shadow level for floating dropdown menus.

---

## 5. Typography

- **Sans-serif (`--font-sans`)**: `Inter` via `next/font/google` with fallback to system sans-serif. Used for UI labels, prose, and headings.
- **Monospace (`--font-mono`)**: `JetBrains Mono` via `next/font/google` with fallback to monospace. Mandatory for all Solana addresses, program IDs, transaction signatures, code blocks, and hashes.
- **Type Scale**:
  - `xs`: 12px (`0.75rem`)
  - `sm`: 14px (`0.875rem`)
  - `base`: 16px (`1rem`)
  - `lg`: 20px (`1.25rem`)
  - `xl`: 28px (`1.75rem`)
  - `2xl`: 40px (`2.5rem`)
- Max two font weights per view (Regular 400 and Semi-bold 600).

---

## 6. The Do & Don't List (AI-Slop Prevention)

| Do | Do NOT |
|---|---|
| Use clean 1px borders to separate surfaces | Do NOT use blurred glassmorphism (`backdrop-blur`) panels |
| Use Lucide icons consistently at 16px (`size-4`) | Do NOT use emojis as UI icons or random sparkle icons |
| Display data in dense, readable tables with copyable mono addresses | Do NOT present endless identical rounded cards in a 3-column grid |
| Provide honest empty, loading, and error states | Do NOT display fake metric cards or decorative progress bars |
| Use clear, concise copy written for Solana engineers | Do NOT use hype copy ("revolutionize", "supercharge", "seamless Web3") |
| Restrict Solana purple/green to small interactive accents and status dots | Do NOT use purple-to-green gradient backgrounds or gradient text |
| Respect `prefers-reduced-motion` | Do NOT use continuous floating or spinning decorative animations |

---

## 7. Component States & Accessibility

Every interactive component must support all eight states:
1. `default`: Rest state using design tokens.
2. `hover`: Subtle surface/border highlight.
3. `focus-visible`: 2px `--accent` focus ring with offset for keyboard navigation.
4. `active`: Slight scale/contrast feedback.
5. `disabled`: Reduced opacity (50%), pointer-events disabled.
6. `loading`: Skeleton shimmer matching layout dimensions.
7. `empty`: Clear explanation of why no items exist and how to add one.
8. `error`: Non-fatal message with a visible retry action.
