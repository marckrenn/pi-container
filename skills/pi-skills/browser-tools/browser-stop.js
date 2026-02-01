#!/usr/bin/env node

import net from "node:net";
import puppeteer from "puppeteer-core";
import { parsePort } from "./browser-port.js";

const usage = () => {
	console.log("Usage: browser-stop.js [--port <port>] ");
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

const browserURL = `http://localhost:${port}`;

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

const waitForPortToClose = async () => {
	for (let i = 0; i < 20; i++) {
		const open = await isPortOpen(port);
		if (!open) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
};

try {
	const browser = await puppeteer.connect({
		browserURL,
		defaultViewport: null,
	});
	await browser.close();
	await waitForPortToClose();
	console.log(`✓ Chrome stopped on :${port}`);
} catch (error) {
	console.error("✗ Could not connect to browser:", error.message);
	console.error("  Run: browser-start.js");
	process.exit(1);
}
