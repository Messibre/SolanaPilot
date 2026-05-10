# ⚡ SolanaPilot Registry Deployment Guide

## Prerequisites Installation

Before deploying the registry program, you need to install:

1. **Rust** (for Solana development)
2. **Solana CLI** (for blockchain interaction)
3. **Anchor CLI** (for smart contract compilation)

### Step 1: Install Rust

**Option A: Direct Download (Recommended)**

1. Visit https://rustup.rs/
2. Click the download link for **x86_64-pc-windows-msvc** (or x86_64-pc-windows-gnu if you prefer)
3. Run the `.exe` file directly
4. Follow the installer prompts (accept defaults for most options)

**Option B: Using Windows Package Manager**

```powershell
# If you have winget installed
winget install Rustlang.Rust.MSVC
```

**Option C: Using Chocolatey**

```powershell
# If you have Chocolatey installed
choco install rust
```

**Option D: Using scoop**

```powershell
# If you have scoop installed
scoop install rust
```

Then verify installation:

```powershell
rustc --version
cargo --version
```

If you get "command not found", restart PowerShell or add Rust to PATH:

```powershell
# Rust installs to: $PROFILE\.cargo\bin
# This should be added to PATH automatically, but if not:
$env:Path += ";$env:USERPROFILE\.cargo\bin"
```

### Step 2: Install Solana CLI

**Option A: Direct Download (Recommended for Windows)**

1. Visit https://github.com/solana-labs/solana/releases
2. Find the latest release version (v1.18.0 or newer)
3. Download **solana-release-x86_64-pc-windows-msvc.tar.bz2**
4. Extract with 7-Zip or WinRAR to a folder (e.g., `C:\solana`)
5. Add `C:\solana\bin` to your Windows PATH:
   - Press `Win+X` → System
   - Advanced system settings → Environment Variables
   - Add folder to PATH
6. Restart PowerShell and verify:
   ```powershell
   solana --version
   ```

**Option B: Using Chocolatey**

```powershell
choco install solana
```

**Option C: Using Windows Package Manager**

```powershell
winget install Solana.Solana
```

**Option D: Using scoop**

```powershell
scoop install solana
```

Verify installation:

```powershell
solana --version
```

### Step 3: Configure Solana for Devnet

```powershell
# Set default cluster to devnet
solana config set --url devnet

# Create a keypair if you don't have one
solana-keygen new -o ~/.config/solana/id.json

# Check your wallet address
solana address

# Fund your wallet with devnet SOL (free faucet)
solana airdrop 2 ~/.config/solana/id.json
```

### Step 4: Install Anchor CLI

```powershell
# Install AVM first (Anchor Version Manager)
cargo install --git https://github.com/coral-xyz/anchor avm --locked

# Install and select the Anchor version used by this project
avm install 0.30.0
avm use 0.30.0
```

Verify:

```powershell
anchor --version
```

## Deployment Steps

Once everything is installed:

### Step 1: Build the Program

```powershell
cd g:\codes\dev3pack\SolanaPilot
anchor build
```

This compiles the Rust program and generates the IDL.

### Step 2: Deploy to Devnet

```powershell
anchor deploy --provider.cluster devnet
```

**Output will look like:**

```
Deploying cluster: https://api.devnet.solana.com
Upgrade authority: /Users/user/.config/solana/id.json
Deploying program "solanapilot_registry"...
Program path: /path/to/target/deploy/solanapilot_registry.so...
Signature: 5D...
Program Id: 9xxx...yzzz
```

### Step 3: Capture Your Program ID

**Copy the Program ID from the deployment output** (e.g., `9xxxxyzzz...`).

Then update these files with your actual program ID:

#### File 1: `Anchor.toml`

```toml
[programs.devnet]
solanapilot_registry = "YOUR_PROGRAM_ID_HERE"
```

#### File 2: `src/registryClient.ts`

```typescript
const REGISTRY_PROGRAM_ID = "YOUR_PROGRAM_ID_HERE";
```

#### File 3: `web-explorer/app/page.tsx`

```typescript
const REGISTRY_PROGRAM_ID = "YOUR_PROGRAM_ID_HERE";
```

#### File 4: `idl/solanapilot_registry.json`

Update the IDL's metadata with your program ID if needed.

### Step 4: Verify Deployment

```powershell
solana program info YOUR_PROGRAM_ID_HERE --url devnet
```

You should see program details confirming it's deployed.

### Step 5: Wire Registration Flow

In `src/programGenerator.ts`, update the `offerRegistryRegistration()` function to:

1. Call `registryClient.initialize(provider)`
2. Pass the newly deployed program ID to `registryClient.registerProgram()`
3. Show success dialog to user

## Testing the Flow

```powershell
# 1. In VS Code, use SolanaPilot: Generate Smart Contract
# 2. After deployment succeeds, the program ID appears in terminal
# 3. Extension automatically calls registerProgram() with that ID
# 4. Check web-explorer: https://solanapilot-registry.vercel.app
# 5. Your program should appear in the registry
```

## Troubleshooting

### Installation Issues

**Q: "rustup-init.exe is not a valid application for this OS platform"**

- A: The file didn't download correctly. Try one of these alternatives:
  - Visit https://rustup.rs/ and download directly
  - Use: `winget install Rustlang.Rust.MSVC`
  - Use: `choco install rust` (if Chocolatey installed)

**Q: "rustc: command not found" after installation**

- A: Restart PowerShell completely (close and reopen)
- A: If still not found, manually add to PATH: `$env:Path += ";$env:USERPROFILE\.cargo\bin"`

**Q: "cargo: command not found"**

- A: Same as above - restart PowerShell completely

**Q: "solana: command not found"**

- A: Ensure the Solana bin folder is in your Windows PATH environment variable
- A: Restart PowerShell after adding to PATH
- A: Check PATH: `$env:Path -split ";"` and verify Solana folder is listed

**Q: "anchor: command not found" after install**

- A: Restart PowerShell after installation
- A: Verify installation: `avm --version`
- A: Run `avm install 0.30.0` then `avm use 0.30.0`
- A: Make sure `~\.cargo\bin` is in PATH so `avm` is available

**Q: Anchor install fails compiling `time v0.3.29` with `E0282`**

- A: Do not compile `anchor-cli` directly on this machine
- A: Use AVM instead: `cargo install --git https://github.com/coral-xyz/anchor avm --locked`
- A: Then run `avm install 0.30.0` and `avm use 0.30.0`

**Q: "The specified executable is not a valid application for this OS platform"**

- A: File download was corrupted - delete and try again
- A: Use alternative installation (winget, choco, scoop)
- A: If on ARM64 Windows, download the ARM64 version instead

### Deployment Issues

**Q: "anchor build" fails with Rust compilation errors**

- A: Update Rust: `rustup update`
- A: Ensure you're in the SolanaPilot root directory: `cd g:\codes\dev3pack\SolanaPilot`
- A: Try: `cargo clean` then `anchor build` again

**Q: "anchor deploy" fails - "Solana cluster unreachable"**

- A: Check internet connection
- A: Verify devnet is operational: https://status.solana.com
- A: Test connectivity: `solana ping --url devnet`

**Q: Deployment fails - "Error: Invalid seeds: custom"**

- A: Your wallet has insufficient SOL balance
- A: Airdrop more devnet SOL: `solana airdrop 2 $(solana address) --url devnet`

**Q: "Program already exists" error on deploy**

- A: You're trying to re-deploy the same program
- A: Either reuse the same program ID or generate new: `solana-keygen new -o new-keypair.json`

**Q: Deploy succeeds but can't find the Program ID**

- A: Scroll up in the terminal - it's usually in the output
- A: Verify with: `solana program info <YOUR_PROGRAM_ID> --url devnet`

### Configuration Issues

**Q: `solana config get` shows wrong cluster**

- A: Reset to devnet: `solana config set --url devnet`

**Q: Can't find my wallet keypair**

- A: Default location: `~/.config/solana/id.json`
- A: On Windows: `$env:USERPROFILE\.config\solana\id.json`
- A: Create new: `solana-keygen new -o ~/.config/solana/id.json`

**Q: Wallet shows 0 SOL balance**

- A: Airdrop devnet SOL: `solana airdrop 2 --url devnet`
- A: Faucet may be rate-limited - try again in 30 seconds

**Q: Multiple Rust toolchains - conflicts**

- A: List versions: `rustup toolchain list`
- A: Set default: `rustup default stable`
- A: Remove old: `rustup toolchain remove nightly`

## Quick Start Checklist

After installing everything, verify with these commands in PowerShell:

```powershell
# Should all return version numbers (1.70+, 1.18+, 0.30.0+)
rustc --version           # Rust compiler
cargo --version           # Rust package manager
solana --version          # Solana CLI
anchor --version          # Anchor framework
solana-keygen --version   # Key generation tool

# Wallet configuration
solana config get         # Should show cluster: https://api.devnet.solana.com
solana address           # Should show a wallet address
solana balance           # Should show SOL balance > 0
```

✅ **All commands return versions?** → Ready to deploy!
❌ **Any command fails?** → Check Troubleshooting section above

## Support

For detailed Anchor docs, see: https://docs.anchor-lang.com/

For Solana CLI reference: https://docs.solana.com/cli
