FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    build-essential \
    pkg-config \
    libssl-dev \
    clang \
    lld \
    git \
    python3 \
    python3-pip \
    make \
    gnupg \
    apt-transport-https \
  && rm -rf /var/lib/apt/lists/*

# Node 18
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
  && apt-get update \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

# Install rustup and toolchain
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup default stable \
  && rustup component add rust-src rustfmt clippy \
  && rustup target add wasm32-unknown-unknown

# Install Solana CLI and keygen via Cargo to avoid flaky release.solana.com installs
RUN set -eux; \
  for i in 1 2 3; do \
    cargo install --locked --version 1.17.0 solana-cli solana-keygen && break; \
    echo "Cargo install failed, retry $i"; \
    sleep 10; \
  done; \
  command -v solana; \
  command -v solana-keygen; \
  solana --version

# Install Anchor CLI
RUN npm install -g @coral-xyz/anchor-cli

WORKDIR /workspace
ENTRYPOINT ["/bin/bash", "-lc"]
