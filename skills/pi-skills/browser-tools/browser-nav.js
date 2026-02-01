#!/usr/bin/env node

import puppeteer from "puppeteer-core";
import { parsePort } from "./browser-port.js";

const usage = () => {
	console.log("Usage: browser-nav.js <url> [--new] [--port <port>]");
	console.log("\nExamples:");
	console.log("  browser-nav.js https://example.com       # Navigate current tab");
	console.log("  browser-nav.js https://example.com --new # Open in new tab");
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

let url = null;
let newTab = false;

for (const arg of args) {
	if (arg === "--new") {
		newTab = true;
	} else if (!url) {
		url = arg;
	} else {
		usage();
	}
}

if (!url) {
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

if (newTab) {
	const p = await b.newPage();
	await p.goto(url, { waitUntil: "domcontentloaded" });
	console.log("✓ Opened:", url);
} else {
	const p = (await b.pages()).at(-1);
	await p.goto(url, { waitUntil: "domcontentloaded" });
	console.log("✓ Navigated to:", url);
}

await b.disconnect();
