FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    build-essential \
    pkg-config \
    libssl-dev \
    libudev-dev \
    bzip2 \
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

# Install Solana CLI (pre-built binary) with retries for network stability
RUN set -eux; \
  SOLANA_VERSION="1.17.0"; \
  SOLANA_INSTALL="/opt/solana"; \
  mkdir -p "${SOLANA_INSTALL}"; \
  for i in 1 2 3 4 5; do \
    curl --ipv4 --tlsv1.2 -sSfL "https://release.solana.com/v${SOLANA_VERSION}/solana-release-x86_64-unknown-linux-gnu.tar.bz2" \
      -o /tmp/solana.tar.bz2 && break; \
    echo "Solana download attempt $i failed, waiting 10s..."; \
    sleep 10; \
  done; \
  if [ ! -f /tmp/solana.tar.bz2 ]; then \
    echo "Failed to download Solana after 5 attempts"; \
    exit 1; \
  fi; \
  tar jxf /tmp/solana.tar.bz2 -C "${SOLANA_INSTALL}" --strip-components=1; \
  rm /tmp/solana.tar.bz2; \
  ln -sf /opt/solana/bin/solana /usr/local/bin/solana; \
  ln -sf /opt/solana/bin/solana-keygen /usr/local/bin/solana-keygen; \
  solana --version
ENV PATH="/opt/solana/bin:${PATH}"

# Install Anchor CLI
RUN npm install -g @coral-xyz/anchor-cli@0.30.0

WORKDIR /workspace
ENTRYPOINT ["/bin/bash", "-lc"]
