// Template strings for Anchor.toml generation

export const ANCHOR_TOML_CONTENT = `
[toolchain]
anchor_version = "0.30.0"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"

[programs.devnet]
solana_program = "11111111111111111111111111111111"

[registry]
url = "https://api.apr.dev"
`;
