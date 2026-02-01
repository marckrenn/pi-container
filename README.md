# Pi Container

Run [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent) in an isolated Linux container using [Apple's container](https://github.com/apple/container).

## Requirements

- macOS 26 (Tahoe) or later
- Apple Silicon Mac

## Install

**One-liner (user-local, persists PATH):**
```bash
git clone https://github.com/marckrenn/pi-container.git ~/.pi-container && mkdir -p ~/.local/bin && ln -sf ~/.pi-container/pi ~/.local/bin/pi-container && PROFILE="$HOME/.zprofile"; [ "${SHELL##*/}" = "bash" ] && PROFILE="$HOME/.bash_profile"; [ "${SHELL##*/}" = "sh" ] && PROFILE="$HOME/.profile"; grep -q "\.local/bin" "$PROFILE" 2>/dev/null || echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$PROFILE"; source "$PROFILE"; pi-container
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
3. Create `~/pi/workspace` and `~/pi/config` if missing
4. Launch pi

## Usage

```bash
pi-container                          # Launch pi in /workspace
pi-container --project <name>         # Launch pi in project folder
pi-container project <name>           # Same as --project
pi-container --project <name> --browser  # Launch pi + headless browser
pi-container --ssh                     # Enable SSH forwarding
pi-container --no-ssh                  # Disable SSH forwarding
pi-container shell --root              # Root shell (for apt install)
pi-container --config shared           # Share ~/.pi/agent (local pi)
pi-container --config fresh            # New empty profile
pi-container --import-config           # Copy ~/.pi/agent into config dir
pi-container projects                  # List all projects
pi-container shell                     # Open bash shell
pi-container status                    # Show container status
pi-container stop                      # Stop the container
pi-container restart                   # Recreate container and launch pi
pi-container reset                     # Delete container (keeps data)
pi-container rebuild                   # Rebuild image from scratch
pi-container help                      # Show help

# Pi passthrough
pi-container config                   # -> pi config
pi-container install npm:pkg          # -> pi install npm:pkg
pi-container pi --help                # -> pi --help
pi-container -- --help                # -> pi --help
```

## Projects

Work on different projects in isolated folders:

```bash
pi-container --project myapp         # Opens ~/pi/workspace/myapp
pi-container --project myapp --browser  # Start browser too
pi-container project api-server      # Same as --project
pi-container project list            # List projects
```

### Pi passthrough

You can call pi subcommands directly (no hardcoded list):

```bash
pi-container config
pi-container install npm:pkg
pi-container -- --help
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

By default, the container runs as **non‑root user `pi`**.

Open a bash shell:

```bash
pi-container shell          # runs as user "pi"

# For root (apt install):
pi-container shell --root

# Inside container:
apt install <package>       # System packages (root only)
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
| `~/pi/config` | `/home/pi/.pi/agent` (default config) |
| `~/.pi/agent` | `/home/pi/.pi/agent` (when `--config shared`) |

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

Headless Chromium is **disabled by default**.

Start it explicitly:
```bash
pi-container --browser
pi-container myapp --browser
```

Or with env:
```bash
PI_BROWSER=1 pi-container
```

Manual start (if needed):

```bash
pi-container shell
cd /home/pi/.pi/agent/skills/pi-skills/browser-tools
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

### Config modes

**Default (local container config):**
```bash
pi-container                 # uses ~/pi/config
```

**Shared with local pi (permanent link):**
```bash
pi-container --config shared # uses ~/.pi/agent directly
```

**Import local config (global):**
```bash
pi-container --import-config           # merge into target config
pi-container --import-config=force     # overwrite target config
```

**Prompts:**
- On first run, if `~/pi/config` is empty, you’ll be asked:
  `Import local pi config from: ~/.pi/agent into: <config_dir>?`
- If the target config is not empty and you run `--import-config`, you’ll be asked whether to overwrite.

**Project-specific config:**
```bash
pi-container --project myapp --config project
```

**Import local config as project starting point:**
```bash
pi-container --project myapp --config project --import-config
pi-container --project myapp --config project --import-config=force
```

**Fresh profile (new empty config):**
```bash
pi-container --config fresh
```

**Named profile:**
```bash
pi-container --profile demo
```

### Custom Base Path

```bash
export PI_CONTAINER_PATH=/path/to/custom
pi-container
```

### SSH Forwarding

On first run you’ll be asked whether to enable SSH agent forwarding. You can override:

```bash
PI_SSH=1 pi-container    # enable
PI_SSH=0 pi-container    # disable
```

Preferences are stored in `~/pi/.pi-container-prefs`.

### Auto-install Container Tool

If Apple's `container` tool is missing, you’ll be prompted to install it. To disable auto-install:

```bash
PI_NO_AUTO_INSTALL=1 pi-container
```

### SSH Forwarding Prompt

On first run you’ll be asked whether to enable SSH agent forwarding. Your choice is saved in `~/pi/.pi-container-prefs`.

### Project-local Skills

This repo can include skills under `./skills/`. On startup, the script syncs them into the active config (unless `--config shared` is used).

### Pin base image / pi version

By default, latest is used. To pin:

```bash
export PI_NODE_IMAGE="node:22-bookworm@sha256:<digest>"
export PI_AGENT_VERSION="0.9.1"   # example
pi-container rebuild
```

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

### Reset install (keep workspace + repo)

**One-liner (keeps `~/pi` data):**
```bash
pi-container reset && container image delete pi-agent:latest 2>/dev/null || true; rm -f ~/.local/bin/pi-container; rm -f /usr/local/bin/pi-container 2>/dev/null || true; rm -rf /Applications/Pi\ Container.app
```

### Full uninstall (also remove workspace)

```bash
pi-container reset
container image delete pi-agent:latest
rm -f ~/.local/bin/pi-container
rm -f /usr/local/bin/pi-container
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
