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

# Install Solana CLI (v1.17.0)
RUN curl --ipv4 --tlsv1.2 -sSfL https://release.solana.com/v1.17.0/install | sh || true
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"

# Install Anchor CLI
RUN npm install -g @coral-xyz/anchor-cli

WORKDIR /workspace
ENTRYPOINT ["/bin/bash", "-lc"]
