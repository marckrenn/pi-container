#!/usr/bin/env node

import puppeteer from "puppeteer-core";
import { parsePort } from "./browser-port.js";

const usage = () => {
	console.log("Usage: browser-cookies.js [--port <port>]");
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

const cookies = await p.cookies();

for (const cookie of cookies) {
	console.log(`${cookie.name}: ${cookie.value}`);
	console.log(`  domain: ${cookie.domain}`);
	console.log(`  path: ${cookie.path}`);
	console.log(`  httpOnly: ${cookie.httpOnly}`);
	console.log(`  secure: ${cookie.secure}`);
	console.log("");
}

await b.disconnect();
