// Template strings for Anchor program generation
// Used by aiClient.ts generateProgram() function

export const ANCHOR_PROGRAM_TEMPLATE = `
use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod {{program_name}} {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
`;

export const CARGO_TOML_TEMPLATE = `
[package]
name = "{{program_name}}"
version = "0.1.0"
edition = "2021"

[dependencies]
anchor-lang = "0.30.0"
anchor-spl = "0.30.0"
solana-program = "1.18"

[lib]
crate-type = ["cdylib", "lib"]
`;

export const WORKSPACE_CARGO_TEMPLATE = `
[workspace]
members = [
    "programs/{{program_name}}"
]

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
`;

export const ANCHOR_TOML_TEMPLATE = `
[toolchain]
anchor_version = "0.30.0"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"

[programs.devnet]
{{program_name}} = "11111111111111111111111111111111"

[registry]
url = "https://api.apr.dev"
`;
