# Pi Coding Agent Container
# Runs @mariozechner/pi-coding-agent in an isolated Linux environment

FROM node:22-bookworm

# Install common development tools and utilities
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    vim \
    nano \
    jq \
    ripgrep \
    fd-find \
    tree \
    htop \
    python3 \
    python3-pip \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks for fd (installed as fdfind on Debian)
RUN ln -s $(which fdfind) /usr/local/bin/fd || true

# Install pi-coding-agent globally
RUN npm install -g @mariozechner/pi-coding-agent

# Create directories for mounted volumes
RUN mkdir -p /workspace /root/.pi/agent

# Set workspace as the default working directory
WORKDIR /workspace

# Default command runs pi
CMD ["pi"]
