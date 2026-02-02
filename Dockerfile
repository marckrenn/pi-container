# Pi Coding Agent Container
# Runs @mariozechner/pi-coding-agent in an isolated Linux environment

ARG NODE_IMAGE=node:22-bookworm
FROM ${NODE_IMAGE}

ARG PI_VERSION=latest

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
RUN npm install -g @mariozechner/pi-coding-agent@${PI_VERSION}

# Create directories for mounted volumes (use existing 'node' user)
RUN mkdir -p /workspace /home/node/.pi/agent \
    && chown -R node:node /home/node /workspace

# Set workspace as the default working directory
WORKDIR /workspace

# Default command runs pi
USER node
CMD ["pi"]
