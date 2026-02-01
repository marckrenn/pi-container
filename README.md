# Pi Container

Run [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent) in an isolated Linux container using [Apple's container](https://github.com/apple/container).

## Requirements

- macOS 26 (Tahoe) or later
- Apple Silicon Mac

## Install

**One-liner (user-local, no sudo):**
```bash
git clone https://github.com/marckrenn/pi-container.git ~/.pi-container && mkdir -p ~/.local/bin && ln -sf ~/.pi-container/pi ~/.local/bin/pi-container && export PATH="$HOME/.local/bin:$PATH" && pi-container
```

**Or manual:**
```bash
git clone https://github.com/marckrenn/pi-container.git ~/.pi-container
mkdir -p ~/.local/bin
ln -sf ~/.pi-container/pi ~/.local/bin/pi-container

# Ensure PATH contains ~/.local/bin (persist)
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zprofile
source ~/.zprofile
pi-container
```

**Or curl installer:**
```bash
curl -fsSL https://raw.githubusercontent.com/marckrenn/pi-container/main/install.sh | bash
```

On first run, the script will:
1. Install Apple's `container` tool (if needed)
2. Build the Linux container image
3. Create directories and launch pi

## Usage

```bash
pi-container                  # Launch pi in /workspace
pi-container <project>        # Launch pi in project folder
pi-container projects         # List all projects
pi-container shell            # Open bash shell
pi-container status           # Show container status
pi-container stop             # Stop the container
pi-container restart          # Recreate container and launch pi
pi-container reset            # Delete container (keeps data)
pi-container rebuild          # Rebuild image from scratch
pi-container help             # Show help
```

## Projects

Work on different projects in isolated folders:

```bash
pi-container myapp            # Opens ~/pi/workspace/myapp
pi-container api-server       # Opens ~/pi/workspace/api-server
pi-container client/frontend  # Nested folders work too
```

List all projects:

```bash
pi-container projects

# Output:
# Projects in ~/pi/workspace:
#
#   ● myapp
#     12 files, 3 folders
#   ● api-server
#     8 files, 2 folders
```

Projects are created automatically if they don't exist.

## Shell Access

Open a bash shell for installing packages:

```bash
pi-container shell

# Inside container:
apt install <package>       # System packages
npm install -g <package>    # Node packages  
pip install <package>       # Python packages
```

## Directory Structure

```
~/pi/
├── workspace/              # Your project files
│   ├── myapp/
│   ├── api-server/
│   └── ...
└── config/                 # Pi config, skills, history
```

| Host | Container |
|------|-----------|
| `~/pi/workspace` | `/workspace` |
| `~/pi/config` | `/root/.pi/agent` |

Both directories are **live mounts** — changes sync instantly.

Your `~/.pi/agent/auth.json` is automatically copied to `~/pi/config/auth.json` on startup (if newer), so API keys work without reconfiguration.

## macOS App

Launch from Dock or Spotlight:

```bash
cp -r "Pi Container.app" /Applications/
```

Then use Spotlight (`Cmd+Space` → "Pi Container") or add to Dock.

## What's Included

| Tool | Version |
|------|---------|
| Node.js | 22 LTS |
| pi-coding-agent | latest |
| Python | 3 |
| git, curl, wget | latest |
| vim, nano | latest |
| ripgrep, fd, jq, tree, htop | latest |
| Chromium (headless) | latest |

## Browser Automation (Headless Chrome)

The container includes **Chromium** for headless browser automation. A project-local copy of the `browser-tools` skill is included in this repo (so it doesn't modify your global skills).

**By default, headless Chromium starts automatically** when you run `pi-container`.

To disable:
```bash
PI_HEADLESS=0 pi-container
```

Manual start (if needed):

```bash
pi-container shell
cd /root/.pi/agent/skills/pi-skills/browser-tools
npm install
./browser-start.js --headless
```

The scripts auto-detect Linux and use `/usr/bin/chromium` by default. You can override with:

```bash
export CHROME_BIN=/path/to/chrome
export CHROME_DIR=/path/to/profile
```

> If you pulled this update, rebuild the image once to install Chromium:
> ```bash
> pi-container rebuild
> ```

## Network & SSH

- **Full internet access** — API calls, package installs, git clone
- **SSH agent forwarding** — Your SSH keys work inside the container

## Configuration

### Custom Base Path

```bash
export PI_CONTAINER_PATH=/path/to/custom
pi-container
```

### Project-local Skills

This repo can include skills under `./skills/`. On startup, the script syncs them into `~/pi/config/skills` so they apply **only to this container**.

### Container Resources

Default: 4 CPUs, 4GB RAM. Edit the `pi` script to change.

## Troubleshooting

```bash
# Container system not running
container system start

# Rebuild everything
pi-container rebuild

# Check status
pi-container status

# View logs
container logs pi-agent

# Fix file permissions
sudo chown -R $(whoami) ~/pi

# Start completely fresh
pi-container reset
rm -rf ~/pi
```

## Uninstall

```bash
pi-container reset
container image delete pi-agent:latest
sudo rm /usr/local/bin/pi-container
rm -rf /Applications/Pi\ Container.app
rm -rf ~/pi  # optional: remove data
```

## Files

```
pi-container/
├── pi                          # Main script
├── install.sh                  # Installer
├── Dockerfile                  # Container image
├── skills/                     # Project-local skills (synced on start)
├── Pi Container.app/           # macOS app
└── README.md
```

## License

MIT
