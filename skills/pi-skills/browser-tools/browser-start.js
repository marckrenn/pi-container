#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import puppeteer from "puppeteer-core";

const DEFAULT_PORT = 9222;
const HOME_DIR = process.env.HOME ?? "";
const DEFAULT_CACHE_DIR = path.join(HOME_DIR, ".cache", "browser-tools");
const LAST_PORT_FILE = path.join(DEFAULT_CACHE_DIR, "last-port");
const IS_LINUX = process.platform === "linux";

const DEFAULT_CHROME_DIR = IS_LINUX
	? fs.existsSync(path.join(HOME_DIR, ".config", "google-chrome"))
		? path.join(HOME_DIR, ".config", "google-chrome")
		: path.join(HOME_DIR, ".config", "chromium")
	: path.join(HOME_DIR, "Library/Application Support/Google/Chrome");

const CHROME_DIR = process.env.CHROME_DIR ?? DEFAULT_CHROME_DIR;
const LOCAL_STATE_PATH = path.join(CHROME_DIR, "Local State");
const DEFAULT_PROFILE_DIR = "Default";

const DEFAULT_CHROME_BIN = IS_LINUX
	? fs.existsSync("/usr/bin/chromium")
		? "/usr/bin/chromium"
		: "/usr/bin/chromium-browser"
	: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const CHROME_BIN = process.env.CHROME_BIN ?? DEFAULT_CHROME_BIN;

const args = process.argv.slice(2);

const usage = () => {
	console.log("Usage: browser-start.js [--profile[=name] | --profile-last-used] [--url <url>] [--port <port>] [--auto-port] [--data-dir <path>] [--headless|--headed] [--restart]");
	console.log("\nOptions:");
	console.log("  --profile [name]        Copy your Chrome profile (cookies, logins).");
	console.log("                          If name is omitted, use Default profile.");
	console.log("  --profile-last-used     Copy the last used profile from Local State.");
	console.log("  --url <url>             Open a page once Chrome is running");
	console.log("  --port <port>           Remote debugging port (overrides auto selection)");
	console.log("  --auto-port             Pick the next free port (default behavior)");
	console.log("  --data-dir <path>       Override the user data directory");
	console.log("  --headless              Run Chrome in headless mode");
	console.log("  --headed                Force headed mode (disable auto headless)");
	console.log("  --restart               Restart Chrome if it's already running on the port");
	console.log("  --restore-tabs          Restore open tabs on restart (default)");
	console.log("  --no-restore-tabs       Do not restore tabs on restart");
	process.exit(1);
};

const expandHome = (value) => value.replace(/^~(?=$|\/|\\)/, HOME_DIR);

const parsePort = (value) => {
	const port = Number.parseInt(value, 10);
	if (!Number.isInteger(port) || port <= 0) {
		console.error(`✗ Invalid port "${value}"`);
		process.exit(1);
	}
	return port;
};

let profileMode = null;
let requestedProfile = null;
let startUrl = null;
let port = DEFAULT_PORT;
let portSpecified = false;
let autoPort = true;
let dataDir = null;
let headless = false;
let forceHeaded = false;
let restart = false;
let restoreTabs = true;

for (let i = 0; i < args.length; i++) {
	const arg = args[i];
	if (arg === "--profile") {
		if (profileMode) {
			usage();
		}
		const next = args[i + 1];
		if (next && !next.startsWith("--")) {
			profileMode = "named";
			requestedProfile = next;
			i++;
		} else {
			profileMode = "default";
		}
	} else if (arg.startsWith("--profile=")) {
		if (profileMode) {
			usage();
		}
		const value = arg.slice("--profile=".length);
		if (!value) {
			usage();
		}
		profileMode = "named";
		requestedProfile = value;
	} else if (arg === "--profile-last-used") {
		if (profileMode) {
			usage();
		}
		profileMode = "last-used";
	} else if (arg === "--url") {
		const value = args[i + 1];
		if (!value || value.startsWith("--")) {
			usage();
		}
		if (startUrl) {
			usage();
		}
		startUrl = value;
		i++;
	} else if (arg.startsWith("--url=")) {
		const value = arg.slice("--url=".length);
		if (!value) {
			usage();
		}
		if (startUrl) {
			usage();
		}
		startUrl = value;
	} else if (arg === "--headless") {
		headless = true;
	} else if (arg === "--headed" || arg === "--no-headless") {
		forceHeaded = true;
		headless = false;
	} else if (arg === "--restart") {
		restart = true;
	} else if (arg === "--restore-tabs") {
		restoreTabs = true;
	} else if (arg === "--no-restore-tabs") {
		restoreTabs = false;
	} else if (arg === "--auto-port") {
		autoPort = true;
		portSpecified = false;
		port = DEFAULT_PORT;
	} else if (arg === "--port") {
		const value = args[i + 1];
		if (!value) {
			usage();
		}
		port = parsePort(value);
		portSpecified = true;
		autoPort = false;
		i++;
	} else if (arg.startsWith("--port=")) {
		const value = arg.slice("--port=".length);
		if (!value) {
			usage();
		}
		port = parsePort(value);
		portSpecified = true;
		autoPort = false;
	} else if (arg === "--data-dir") {
		const value = args[i + 1];
		if (!value) {
			usage();
		}
		dataDir = expandHome(value);
		i++;
	} else if (arg.startsWith("--data-dir=")) {
		const value = arg.slice("--data-dir=".length);
		if (!value) {
			usage();
		}
		dataDir = expandHome(value);
	} else {
		usage();
	}
}

const useProfile = profileMode !== null;

const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
if (!headless && !forceHeaded && IS_LINUX && !hasDisplay) {
	headless = true;
	console.log("ℹ No DISPLAY found; defaulting to --headless. Use --headed to override.");
}

const isPortOpen = (portToCheck) =>
	new Promise((resolve) => {
		const socket = new net.Socket();
		const finish = (result) => {
			socket.destroy();
			resolve(result);
		};

		socket.setTimeout(300);
		socket.once("connect", () => finish(true));
		socket.once("timeout", () => finish(false));
		socket.once("error", (error) => {
			if (error?.code === "ECONNREFUSED" || error?.code === "EHOSTUNREACH") {
				finish(false);
			} else {
				finish(true);
			}
		});
		socket.connect(portToCheck, "127.0.0.1");
	});

const findAvailablePort = async (startPort, attempts = 20) => {
	for (let offset = 0; offset <= attempts; offset++) {
		const candidate = startPort + offset;
		const inUse = await isPortOpen(candidate);
		if (!inUse) {
			return candidate;
		}
	}
	console.error(`✗ Could not find a free port starting at ${startPort}`);
	process.exit(1);
};

const shouldAutoPort = autoPort && !restart && !portSpecified;
if (shouldAutoPort) {
	port = await findAvailablePort(DEFAULT_PORT);
}

const defaultCacheDir =
	port === DEFAULT_PORT
		? DEFAULT_CACHE_DIR
		: path.join(HOME_DIR, ".cache", `browser-tools-${port}`);
const SCRAPING_DIR = dataDir ?? defaultCacheDir;
const browserURL = `http://localhost:${port}`;
const shouldRestoreTabs = restart && restoreTabs;

const readJson = (filePath) => {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch {
		return null;
	}
};

const getLastUsedProfileDir = () => {
	const localState = readJson(LOCAL_STATE_PATH);
	return (
		localState?.profile?.last_used ||
		localState?.profile?.last_active_profiles?.[0] ||
		DEFAULT_PROFILE_DIR
	);
};

const getProfileEntries = () => {
	const entries = [];
	let dirs = [];

	try {
		dirs = fs.readdirSync(CHROME_DIR, { withFileTypes: true });
	} catch {
		return entries;
	}

	for (const entry of dirs) {
		if (!entry.isDirectory()) continue;
		const prefPath = path.join(CHROME_DIR, entry.name, "Preferences");
		if (!fs.existsSync(prefPath)) continue;
		const pref = readJson(prefPath);
		const profileName = pref?.profile?.name ?? entry.name;
		entries.push({ dir: entry.name, name: profileName ?? entry.name });
	}

	const localState = readJson(LOCAL_STATE_PATH);
	const infoCache = localState?.profile?.info_cache ?? {};
	for (const [dir, info] of Object.entries(infoCache)) {
		if (!info?.name) continue;
		const existing = entries.find((entry) => entry.dir === dir);
		if (existing) {
			existing.name = info.name;
		}
	}

	return entries;
};

const formatProfileList = (entries) =>
	entries
		.map((entry) => `${entry.name} (${entry.dir})`)
		.sort();

const parseProfileDescriptor = (value) => {
	if (!value) return null;
	const match = value.match(/^(.*)\s+\(([^)]+)\)$/);
	if (!match) return null;
	const name = match[1].trim();
	const dir = match[2].trim();
	if (!name || !dir) return null;
	return { name, dir };
};

const resolveByDir = (dir, entries) => {
	const entry = entries.find((entry) => entry.dir === dir);
	return { profileDir: dir, profileName: entry?.name ?? dir };
};

const promptForProfileSelection = async (requestedName, matches) => {
	if (!process.stdin.isTTY) return null;

	console.log(`Multiple profiles named "${requestedName}".`);
	matches.forEach((match, index) => {
		console.log(`  ${index + 1}) ${match.name} (${match.dir})`);
	});

	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		const answer = await rl.question("Select profile number: ");
		const choice = Number.parseInt(answer, 10);
		if (!Number.isInteger(choice) || choice < 1 || choice > matches.length) {
			return null;
		}
		return matches[choice - 1];
	} finally {
		rl.close();
	}
};

const resolveNamedProfile = async (requestedName, entries) => {
	const trimmed = requestedName?.trim();
	if (!trimmed) {
		return resolveByDir(DEFAULT_PROFILE_DIR, entries);
	}

	const descriptor = parseProfileDescriptor(trimmed);
	if (descriptor) {
		const match = entries.find(
			(entry) => entry.dir === descriptor.dir && entry.name === descriptor.name,
		);
		if (match) {
			return { profileDir: match.dir, profileName: match.name };
		}
	}

	const nameMatches = entries.filter((entry) => entry.name === trimmed);
	if (nameMatches.length === 1) {
		return { profileDir: nameMatches[0].dir, profileName: nameMatches[0].name };
	}
	if (nameMatches.length > 1) {
		const selected = await promptForProfileSelection(trimmed, nameMatches);
		if (selected) {
			return { profileDir: selected.dir, profileName: selected.name };
		}

		console.error(`✗ Profile name "${requestedName}" is ambiguous.`);
		console.error("Matches:");
		for (const match of nameMatches) {
			console.error(`  - ${match.name} (${match.dir})`);
		}
		console.error("Use --profile \"Name (Profile X)\" or --profile \"Profile X\" to select a directory.");
		process.exit(1);
	}

	const dirMatch = entries.find((entry) => entry.dir === trimmed);
	if (dirMatch) {
		return { profileDir: dirMatch.dir, profileName: dirMatch.name };
	}

	const available = formatProfileList(entries);

	console.error(`✗ Unknown Chrome profile "${requestedName}".`);
	if (available.length) {
		console.error("Available profiles:");
		for (const entry of available) {
			console.error(`  - ${entry}`);
		}
	}
	process.exit(1);
};

const resolveProfile = async () => {
	const entries = getProfileEntries();

	if (profileMode === "named") {
		return await resolveNamedProfile(requestedProfile, entries);
	}
	if (profileMode === "last-used") {
		return resolveByDir(getLastUsedProfileDir(), entries);
	}
	if (profileMode === "default") {
		return resolveByDir(DEFAULT_PROFILE_DIR, entries);
	}

	return { profileDir: null, profileName: null };
};

const formatProfileLabel = (profileName, profileDir) => {
	if (!profileName && !profileDir) return null;
	if (profileName && profileDir && profileName !== profileDir) {
		return `${profileName} (${profileDir})`;
	}
	return profileName ?? profileDir;
};

const persistLastPort = (portValue) => {
	try {
		fs.mkdirSync(DEFAULT_CACHE_DIR, { recursive: true });
		fs.writeFileSync(LAST_PORT_FILE, String(portValue), "utf8");
	} catch {}
};

const isRestorableUrl = (url) => {
	if (!url) return false;
	if (url === "about:blank") return false;
	if (url.startsWith("chrome://")) return false;
	if (url.startsWith("chrome-extension://")) return false;
	if (url.startsWith("chrome-search://")) return false;
	if (url.startsWith("devtools://")) return false;
	if (url.startsWith("about:")) return false;
	return true;
};

const collectRestorableUrls = (pages) => {
	const urls = [];
	const seen = new Set();
	for (const page of pages) {
		const url = page.url();
		if (!isRestorableUrl(url) || seen.has(url)) continue;
		seen.add(url);
		urls.push(url);
	}
	return urls;
};

const openUrls = async (
	browserInstance,
	urls,
	{ required = false, alwaysNewTab = false, preferExisting = false } = {},
) => {
	const list = [];
	const seen = new Set();
	for (const url of urls) {
		if (!url || seen.has(url)) continue;
		seen.add(url);
		list.push(url);
	}
	if (!list.length) return 0;
	const pages = await browserInstance.pages();
	if (preferExisting && list.length === 1) {
		const existing = pages.find((page) => page.url() === list[0]);
		if (existing) {
			if (existing.bringToFront) {
				await existing.bringToFront();
			}
			return 1;
		}
	}
	let page = alwaysNewTab ? null : pages.at(-1);
	for (let i = 0; i < list.length; i++) {
		const url = list[i];
		if (!page) {
			page = await browserInstance.newPage();
		}
		try {
			await page.goto(url, { waitUntil: "domcontentloaded" });
		} catch (error) {
			const message = `✗ Failed to open ${url}: ${error?.message ?? error}`;
			if (required) {
				throw new Error(message);
			}
			console.error(message);
		}
		if (i < list.length - 1) {
			page = await browserInstance.newPage();
		}
	}
	if (page?.bringToFront) {
		await page.bringToFront();
	}
	return list.length;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForPortToClose = async () => {
	for (let i = 0; i < 20; i++) {
		try {
			const browser = await puppeteer.connect({
				browserURL,
				defaultViewport: null,
			});
			await browser.disconnect();
			await sleep(250);
		} catch {
			return;
		}
	}
};

let restoreUrls = [];

// Check if already running on the port
try {
	const browser = await puppeteer.connect({
		browserURL,
		defaultViewport: null,
	});
	if (!restart) {
		if (startUrl) {
			await openUrls(browser, [startUrl], { required: true });
			console.log(`✓ Opened: ${startUrl}`);
		}
		await browser.disconnect();
		persistLastPort(port);
		console.log(`✓ Chrome already running on :${port}`);
		process.exit(0);
	}
	if (shouldRestoreTabs) {
		restoreUrls = collectRestorableUrls(await browser.pages());
	}
	console.log(`↻ Restarting Chrome on :${port}`);
	await browser.close();
	await waitForPortToClose();
} catch {}

let profileDir = null;
let profileName = null;
let profileLabel = null;

if (useProfile) {
	({ profileDir, profileName } = await resolveProfile());
	profileLabel = formatProfileLabel(profileName, profileDir);
}

const explicitUrl = startUrl && (!shouldRestoreTabs || !restoreUrls.includes(startUrl)) ? startUrl : null;

// Setup profile directory
execSync(`mkdir -p "${SCRAPING_DIR}"`, { stdio: "ignore" });

// Remove SingletonLock to allow new instance
try {
	execSync(`rm -f "${SCRAPING_DIR}/SingletonLock" "${SCRAPING_DIR}/SingletonSocket" "${SCRAPING_DIR}/SingletonCookie"`, { stdio: "ignore" });
} catch {}

if (useProfile) {
	console.log(`Syncing profile${profileLabel ? ` (${profileLabel})` : ""}...`);
	execSync(
		`rsync -a --delete \
			--exclude='SingletonLock' \
			--exclude='SingletonSocket' \
			--exclude='SingletonCookie' \
			--exclude='*/Sessions/*' \
			--exclude='*/Current Session' \
			--exclude='*/Current Tabs' \
			--exclude='*/Last Session' \
			--exclude='*/Last Tabs' \
			"${CHROME_DIR}/" "${SCRAPING_DIR}/"`,
		{ stdio: "pipe" },
	);
}

const chromeArgs = [
	`--remote-debugging-port=${port}`,
	`--user-data-dir=${SCRAPING_DIR}`,
	"--no-first-run",
	"--no-default-browser-check",
];

if (IS_LINUX && process.getuid && process.getuid() === 0) {
	chromeArgs.push("--no-sandbox", "--disable-setuid-sandbox");
}

if (useProfile && profileDir) {
	chromeArgs.push(`--profile-directory=${profileDir}`);
}

if (headless) {
	chromeArgs.push("--headless=new", "--disable-gpu");
}

if (explicitUrl) {
	chromeArgs.push(explicitUrl);
}

if (!fs.existsSync(CHROME_BIN)) {
	console.error(`✗ Chrome/Chromium not found at ${CHROME_BIN}`);
	console.error("Install chromium or set CHROME_BIN.");
	process.exit(1);
}

spawn(CHROME_BIN, chromeArgs, {
	detached: true,
	stdio: "ignore",
}).unref();

// Wait for Chrome to be ready
let connected = false;
for (let i = 0; i < 30; i++) {
	try {
		const browser = await puppeteer.connect({
			browserURL,
			defaultViewport: null,
		});
		await browser.disconnect();
		connected = true;
		break;
	} catch {
		await sleep(500);
	}
}

if (!connected) {
	console.error("✗ Failed to connect to Chrome");
	process.exit(1);
}

if (restoreUrls.length || explicitUrl) {
	try {
		const browser = await puppeteer.connect({
			browserURL,
			defaultViewport: null,
		});
		if (restoreUrls.length) {
			const restoredCount = await openUrls(browser, restoreUrls);
			if (restoredCount) {
				console.log(`✓ Restored ${restoredCount} tab${restoredCount === 1 ? "" : "s"}`);
			}
		}
		if (explicitUrl) {
			const openedCount = await openUrls(browser, [explicitUrl], {
				required: true,
				alwaysNewTab: restoreUrls.length > 0,
				preferExisting: true,
			});
			if (openedCount) {
				console.log(`✓ Opened: ${explicitUrl}`);
			}
		}
		await browser.disconnect();
	} catch (error) {
		console.error(`✗ Failed to open ${explicitUrl ?? "startup URLs"}: ${error?.message ?? error}`);
		process.exit(1);
	}
}

persistLastPort(port);
console.log(`✓ Chrome started on :${port}${useProfile ? ` with profile ${profileLabel ?? "Default"}` : ""}${headless ? " (headless)" : ""}`);
