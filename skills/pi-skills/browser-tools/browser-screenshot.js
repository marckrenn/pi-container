#!/usr/bin/env node

import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import { parsePort } from "./browser-port.js";

const usage = () => {
	console.log("Usage: browser-screenshot.js [--port <port>]");
	process.exit(1);
};

let port;
let args;
try {
	({ port, args } = parsePort(process.argv.slice(2)));
} catch (error) {
	console.error(`✗ ${error.message}`);
	usage();
}

if (args.length > 0) {
	usage();
}

const b = await Promise.race([
	puppeteer.connect({
		browserURL: `http://localhost:${port}`,
		defaultViewport: null,
	}),
	new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
]).catch((e) => {
	console.error("✗ Could not connect to browser:", e.message);
	console.error("  Run: browser-start.js");
	process.exit(1);
});

const p = (await b.pages()).at(-1);

if (!p) {
	console.error("✗ No active tab found");
	process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const filename = `screenshot-${timestamp}.png`;
const filepath = join(tmpdir(), filename);

await p.screenshot({ path: filepath });

console.log(filepath);

await b.disconnect();
