# SolanaPilot Registry Contract Specification

The SolanaPilot Registry (`solanapilot_registry`) is an on-chain catalog for AI-generated Solana programs. It provides programmatic provenance, immutable creator attribution, deployment telemetry, and metadata tracking.

- **Program ID**: `HsgU4dZEKDmWbSufhdA6zJrdz6RJDaSzrN5VQToCDpXa`
- **Framework**: Anchor 0.31
- **PDA Scheme**: `["program", program_id]`

---

## Account Architecture

### `ProgramEntry`

The primary registry state account storing metadata for each registered Solana program.

| Field | Type | Offset / Size | Description |
|---|---|---|---|
| `discriminator` | `[u8; 8]` | 8 bytes | Anchor 8-byte account discriminator |
| `program_id` | `Pubkey` | 32 bytes | The public key of the registered Solana program |
| `program_name` | `String` | 4 + 50 bytes | Lowercase snake_case ASCII name (max 50 chars) |
| `description` | `String` | 4 + 200 bytes | Human-readable description (max 200 chars) |
| `instruction_count` | `u8` | 1 byte | Count of instructions defined in the program (1..=50) |
| `creator` | `Pubkey` | 32 bytes | The wallet authority that originally registered the program |
| `registered_at` | `i64` | 8 bytes | Unix timestamp of original registration |
| `last_updated` | `i64` | 8 bytes | Unix timestamp of most recent metadata update |
| `generator_version` | `String` | 4 + 20 bytes | SolanaPilot generator version string (max 20 chars) |
| `deployment_count` | `u64` | 8 bytes | Counter incremented on subsequent user deployments |
| `bump` | `u8` | 1 byte | PDA canonical bump seed |

**Space Calculation**:
- `InitSpace` = 32 + (4 + 50) + (4 + 200) + 1 + 32 + 8 + 8 + (4 + 20) + 8 + 1 = 372 bytes.
- Total allocated account space: `8 + ProgramEntry::INIT_SPACE` = **380 bytes**.

---

## Instructions Specification

### 1. `register_program`

Registers a newly generated program into the global registry. Derives the PDA from `[b"program", program_id.as_ref()]`.

- **Caller / Authority**: Any signer (`creator: Signer<'info>`).
- **Accounts**:
  1. `program_entry`: `[init, payer = creator, space = 380, seeds = [b"program", program_id], bump]` (Writable)
  2. `creator`: `[mut, signer]` (Payer and registered owner)
  3. `system_program`: `Program<'info, System>`
- **Arguments**:
  - `program_id`: `Pubkey`
  - `program_name`: `String`
  - `description`: `String`
  - `instruction_count`: `u8`
  - `generator_version`: `String`
- **What it Validates**:
  - `program_id` cannot be the System Program (`11111111111111111111111111111111`) or Clock/Rent sysvars (`InvalidProgramId`).
  - `program_name` must be 1..=50 chars, non-empty, ASCII, start with a lowercase letter, followed by lowercase letters, digits, or underscores (`InvalidProgramName`).
  - `description` must not be whitespace-only (`InvalidDescription`) and must be $\le 200$ bytes (`DescriptionTooLong`).
  - `instruction_count` must be within `MIN_INSTRUCTION_COUNT` (1) and `MAX_INSTRUCTION_COUNT` (50) (`InvalidInstructionCount`).
  - `generator_version` must not be whitespace-only (`InvalidGeneratorVersion`) and must be $\le 20$ bytes (`GeneratorVersionTooLong`).
  - Account does not already exist (guaranteed by Anchor `init` with PDA).
- **State Changes**:
  - Initializes `ProgramEntry` with fields populated from arguments and clock.
  - Sets `deployment_count = 0`.
- **Events Emitted**:
  - `ProgramRegisteredEvent { program_id, program_name, creator, timestamp }`

---

### 2. `log_deployment`

Increments the on-chain deployment counter when the program is deployed to Solana.

- **Caller / Authority**: **Original creator only** (`authority: Signer<'info>`).
- **Accounts**:
  1. `program_entry`: `[mut, seeds = [b"program", program_entry.program_id], bump = program_entry.bump, constraint = program_entry.creator == authority.key()]` (Writable)
  2. `authority`: `[signer]` (Must equal `program_entry.creator`)
- **Arguments**: None.
- **What it Validates**:
  - `authority.key() == program_entry.creator` enforced by both account constraint and runtime check (`Unauthorized`).
  - Checked math: `deployment_count.checked_add(1)` does not overflow `u64` (`Overflow`).
- **State Changes**:
  - `deployment_count += 1`.
- **Events Emitted**:
  - `DeploymentLoggedEvent { program_id, deployment_count, authority }`

---

### 3. `update_program_info`

Updates the metadata (description and/or instruction count) of an existing registered program.

- **Caller / Authority**: **Original creator only** (`creator: Signer<'info>`).
- **Accounts**:
  1. `program_entry`: `[mut, seeds = [b"program", program_entry.program_id], bump = program_entry.bump, has_one = creator @ ErrorCode::Unauthorized]` (Writable)
  2. `creator`: `[signer]` (Must match `program_entry.creator`)
- **Arguments**:
  - `new_description`: `Option<String>`
  - `new_instruction_count`: `Option<u8>`
- **What it Validates**:
  - `ctx.accounts.creator.key() == program_entry.creator` enforced via `has_one = creator` (`Unauthorized`).
  - If `new_description` is provided: must not be empty or whitespace-only (`InvalidDescription`) and $\le 200$ bytes (`DescriptionTooLong`).
  - If `new_instruction_count` is provided: must be between 1 and 50 (`InvalidInstructionCount`).
- **State Changes**:
  - Updates `description` (if provided).
  - Updates `instruction_count` (if provided).
  - Updates `last_updated = Clock::get()?.unix_timestamp`.
- **Events Emitted**:
  - `ProgramInfoUpdatedEvent { program_id, last_updated, instruction_count }`

---

### 4. `close_program_entry`

Closes an existing registry entry and reclaims all deposited rent.

- **Caller / Authority**: **Original creator only** (`creator: Signer<'info>`).
- **Accounts**:
  1. `program_entry`: `[mut, seeds = [b"program", program_entry.program_id], bump = program_entry.bump, has_one = creator @ ErrorCode::Unauthorized, close = creator]` (Writable)
  2. `creator`: `[mut, signer]` (Receives refunded rent lamports)
- **Arguments**: None.
- **What it Validates**:
  - `creator.key() == program_entry.creator` enforced via `has_one = creator` (`Unauthorized`).
- **State Changes**:
  - `program_entry` account is closed and its data zeroed; rent lamports transferred to `creator`.
- **Events Emitted**:
  - `ProgramEntryClosedEvent { program_id, creator }`

---

## Error Codes Reference

| Code | Name | Message |
|---|---|---|
| `6000` | `InvalidProgramId` | Program ID is invalid (cannot be system program or sysvar) |
| `6001` | `InvalidProgramName` | Program name must be snake_case ASCII and 1-50 characters long |
| `6002` | `InvalidDescription` | Description cannot be empty |
| `6003` | `DescriptionTooLong` | Description exceeds 200 character limit |
| `6004` | `InvalidInstructionCount` | Instruction count must be between 1 and 50 |
| `6005` | `InvalidGeneratorVersion` | Generator version cannot be empty |
| `6006` | `GeneratorVersionTooLong` | Generator version exceeds 20 character limit |
| `6007` | `Overflow` | Overflow in deployment counter |
| `6008` | `Unauthorized` | Unauthorized: only the creator can perform this action |

