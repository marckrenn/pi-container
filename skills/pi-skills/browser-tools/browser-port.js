import fs from "node:fs";
import path from "node:path";

export const DEFAULT_PORT = 9222;

const HOME_DIR = process.env.HOME ?? "";
const LAST_PORT_FILE = path.join(HOME_DIR, ".cache", "browser-tools", "last-port");

const parsePortValue = (value) => {
	const port = Number.parseInt(value, 10);
	if (!Number.isInteger(port) || port <= 0) {
		throw new Error(`Invalid port "${value}"`);
	}
	return port;
};

const loadDefaultPort = () => {
	try {
		const saved = fs.readFileSync(LAST_PORT_FILE, "utf8").trim();
		if (saved) {
			return parsePortValue(saved);
		}
	} catch {}
	return DEFAULT_PORT;
};

export const parsePort = (args) => {
	let port = loadDefaultPort();
	const remaining = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--port") {
			const value = args[i + 1];
			if (!value) {
				throw new Error("Missing value for --port");
			}
			port = parsePortValue(value);
			i++;
		} else if (arg.startsWith("--port=")) {
			const value = arg.slice("--port=".length);
			if (!value) {
				throw new Error("Missing value for --port");
			}
			port = parsePortValue(value);
		} else {
			remaining.push(arg);
		}
	}

	return { port, args: remaining };
};
