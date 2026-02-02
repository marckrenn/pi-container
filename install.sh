#!/bin/bash
#
# Pi Container Installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/marckrenn/pi-container/main/install.sh | bash
#

set -e

REPO_URL="https://github.com/marckrenn/pi-container.git"
INSTALL_DIR="$HOME/.pi-container"

echo ""
echo "Installing Pi Container..."
echo ""

# Clone or update repo
if [ -d "$INSTALL_DIR" ]; then
    echo "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull --quiet
else
    echo "Downloading..."
    git clone --quiet "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Create symlink (user-local)
echo "Creating symlink..."
mkdir -p "$HOME/.local/bin"
ln -sf "$INSTALL_DIR/pi" "$HOME/.local/bin/pi-container"

# Warn about legacy /usr/local/bin install
if [ -e /usr/local/bin/pi-container ]; then
    echo ""
    echo "⚠ Found /usr/local/bin/pi-container (legacy install)."
    echo "  This may shadow ~/.local/bin in your PATH."
    read -p "Remove it now? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo rm /usr/local/bin/pi-container || true
    else
        echo "Remove manually: sudo rm /usr/local/bin/pi-container"
    fi
fi

# Ensure PATH includes ~/.local/bin
if ! echo "$PATH" | tr ':' '\n' | grep -q "^$HOME/.local/bin$"; then
    echo "Adding ~/.local/bin to PATH..."

    TARGET_SHELL="${SHELL##*/}"
    if [ "$TARGET_SHELL" = "zsh" ]; then
        PROFILE_FILE="$HOME/.zprofile"
        RC_FILE="$HOME/.zshrc"
    elif [ "$TARGET_SHELL" = "bash" ]; then
        PROFILE_FILE="$HOME/.bash_profile"
        RC_FILE="$HOME/.bashrc"
    else
        PROFILE_FILE="$HOME/.profile"
        RC_FILE="$HOME/.profile"
    fi

    if [ ! -f "$PROFILE_FILE" ] || ! grep -q "\.local/bin" "$PROFILE_FILE"; then
        printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$PROFILE_FILE"
    fi

    if [ "$RC_FILE" != "$PROFILE_FILE" ]; then
        if [ ! -f "$RC_FILE" ] || ! grep -q "\.local/bin" "$RC_FILE"; then
            printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$RC_FILE"
        fi
    fi

    echo "Added to $PROFILE_FILE"
    [ -n "$RC_FILE" ] && echo "Added to $RC_FILE"
    echo "Reload your shell or run: source $PROFILE_FILE"
fi

# Create default workspace/config dirs
mkdir -p "$HOME/pi/workspace" "$HOME/pi/config"

# Copy app to Applications (optional)
if [ -d "$INSTALL_DIR/Pi Container.app" ]; then
    echo "Installing macOS app..."
    cp -r "$INSTALL_DIR/Pi Container.app" /Applications/ 2>/dev/null || true
fi

echo ""
echo "✓ Installed! Run: pi-container"
echo ""
