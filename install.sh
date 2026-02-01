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

# Create symlink
echo "Creating symlink..."
sudo ln -sf "$INSTALL_DIR/pi" /usr/local/bin/pi-container

# Copy app to Applications (optional)
if [ -d "$INSTALL_DIR/Pi Container.app" ]; then
    echo "Installing macOS app..."
    cp -r "$INSTALL_DIR/Pi Container.app" /Applications/ 2>/dev/null || true
fi

echo ""
echo "✓ Installed! Run: pi-container"
echo ""
