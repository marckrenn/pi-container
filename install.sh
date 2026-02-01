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

# Ensure PATH includes ~/.local/bin
if ! echo "$PATH" | tr ':' '\n' | grep -q "^$HOME/.local/bin$"; then
    echo "Adding ~/.local/bin to PATH..."

    TARGET_SHELL="${SHELL##*/}"
    if [ "$TARGET_SHELL" = "zsh" ]; then
        PROFILE_FILE="$HOME/.zprofile"
    elif [ "$TARGET_SHELL" = "bash" ]; then
        PROFILE_FILE="$HOME/.bash_profile"
    else
        PROFILE_FILE="$HOME/.profile"
    fi

    if [ ! -f "$PROFILE_FILE" ] || ! grep -q "\.local/bin" "$PROFILE_FILE"; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$PROFILE_FILE"
    fi

    echo "Added to $PROFILE_FILE"
    echo "Reload your shell or run: source $PROFILE_FILE"
fi

# Copy app to Applications (optional)
if [ -d "$INSTALL_DIR/Pi Container.app" ]; then
    echo "Installing macOS app..."
    cp -r "$INSTALL_DIR/Pi Container.app" /Applications/ 2>/dev/null || true
fi

echo ""
echo "✓ Installed! Run: pi-container"
echo ""
