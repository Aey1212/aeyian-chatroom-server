// SPDX-License-Identifier: AGPL-3.0-or-later

// Smoke test for the installed Windows app: start it with a DevTools port, wait until it shows chat.aeyempire.com,
// print what the page shows, save a screenshot. Fails when the site never opens or the desktop bridge is missing.
// Usage: node windows-smoke-test.mjs <path to Aeyian Chatline.exe> <screenshot.png>

import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';

const [exePath, screenshotPath] = process.argv.slice(2);
const DEBUG_PORT = 9333;
const APP_ORIGIN = 'https://chat.aeyempire.com';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const app = spawn(exePath, [`--remote-debugging-port=${DEBUG_PORT}`], {detached: true, stdio: 'ignore'});
app.unref();

let target = null;
for (let second = 0; second < 120 && !target; second++) {
	await sleep(1000);
	try {
		const pages = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
		target = pages.find((page) => page.type === 'page' && page.url.startsWith(APP_ORIGIN)) ?? null;
	} catch {
		// The app is still starting.
	}
}
if (!target) {
	console.error(`The app did not open ${APP_ORIGIN} within two minutes.`);
	process.exit(1);
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
	socket.onopen = resolve;
	socket.onerror = reject;
});
let nextId = 0;
const waiting = new Map();
socket.onmessage = (event) => {
	const message = JSON.parse(event.data);
	waiting.get(message.id)?.(message);
	waiting.delete(message.id);
};
const send = (method, params = {}) =>
	new Promise((resolve) => {
		const id = ++nextId;
		waiting.set(id, resolve);
		socket.send(JSON.stringify({id, method, params}));
	});
const evaluate = async (expression) =>
	(await send('Runtime.evaluate', {expression, returnByValue: true})).result?.result?.value;

// Give the web app time to render its first screen.
await sleep(20000);
const shown = {
	url: await evaluate('location.href'),
	title: await evaluate('document.title'),
	desktopBridge: await evaluate('typeof window.electron'),
	text: await evaluate('document.body.innerText.slice(0, 400)'),
};
console.log(JSON.stringify(shown, null, 2));

const screenshot = await send('Page.captureScreenshot', {format: 'png'});
if (screenshot.result?.data) writeFileSync(screenshotPath, Buffer.from(screenshot.result.data, 'base64'));
socket.close();

const ok = shown.url?.startsWith(APP_ORIGIN) && shown.desktopBridge === 'object';
console.log(ok ? 'Smoke test passed.' : 'Smoke test failed.');
process.exit(ok ? 0 : 1);
