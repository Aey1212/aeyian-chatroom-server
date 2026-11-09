// SPDX-License-Identifier: AGPL-3.0-or-later

// Upstream Fluxer e58e75067 (#3761), without its signed-link and instance CSS parts: link signing is
// off on this instance and there is no instance-wide custom CSS. Custom theme CSS may load only
// data: images and fonts, the theme library's own blob: files, in-document #fragments, attachment
// links on our media server, and Google or coollabs fonts. Anything else, including the media
// server's /external/ proxy, becomes url("data:,"), and every other @import is dropped. If the
// filtered CSS still changes on a second pass (a broken string, comment or bracket), none of it is
// applied.

import {isAttachmentCdnUrl} from '@app/features/messaging/utils/AttachmentCdnUrl';
import {type CSSToken, TokenType, tokenize} from '@csstools/css-tokenizer';

export const REJECTED_CSS_URL = 'data:,';

const REJECTED_CSS_VALUE = `url("${REJECTED_CSS_URL}")`;
const ENCODED_SEPARATOR_PATTERN = /%2f|%5c|\\/i;
const FRAGMENT_REFERENCE_PATTERN = /^#[^/\\:]*$/;
const DATA_URL_PATTERN =
	/^data:(image\/(png|jpeg|gif|webp|avif|svg\+xml)|font\/[a-z0-9.+-]+|application\/(font-woff2?|x-font-[a-z0-9]+|vnd\.ms-fontobject))[;,]/i;
const FONT_STYLESHEET_ORIGINS: ReadonlySet<string> = new Set([
	'https://fonts.googleapis.com',
	'https://api.fonts.coollabs.io',
]);
const FONT_STYLESHEET_PATHS: ReadonlySet<string> = new Set(['/css', '/css2']);
const FONT_FILE_PATH_PREFIXES: ReadonlyMap<string, string> = new Map([
	['https://fonts.gstatic.com', '/s/'],
	['https://cdn.fonts.coollabs.io', '/'],
]);
const URL_FUNCTIONS: ReadonlySet<string> = new Set([
	'url',
	'url-prefix',
	'domain',
	'src',
	'image',
	'image-set',
	'-webkit-image-set',
	'cross-fade',
	'-webkit-cross-fade',
]);
const FUNCTIONS_ALLOWED_IN_URL_FUNCTIONS: ReadonlySet<string> = new Set([
	'url',
	'image-set',
	'-webkit-image-set',
	'type',
]);
const CLOSER_BY_OPENER: ReadonlyMap<TokenType, TokenType> = new Map([
	[TokenType.Function, TokenType.CloseParen],
	[TokenType.OpenParen, TokenType.CloseParen],
	[TokenType.OpenSquare, TokenType.CloseSquare],
	[TokenType.OpenCurly, TokenType.CloseCurly],
]);

export interface ThemeCssGatePolicy {
	readonly mediaEndpoint: string;
	readonly objectUrls: ReadonlySet<string>;
}

export interface ThemeCssGateResult {
	readonly css: string;
	readonly rejected: boolean;
	readonly blocked: ReadonlyArray<string>;
}

interface Replacement {
	readonly from: number;
	readonly to: number;
	readonly text: string;
}

interface GatePass {
	readonly css: string;
	readonly changed: boolean;
	readonly blocked: Array<string>;
}

function parseUrl(value: string): URL | null {
	try {
		return new URL(value);
	} catch {
		return null;
	}
}

function canonicalAttachmentUrl(value: string, mediaEndpoint: string): string | null {
	if (ENCODED_SEPARATOR_PATTERN.test(value) || !isAttachmentCdnUrl(value, mediaEndpoint)) return null;
	const url = parseUrl(value);
	if (url === null || url.hash !== '') return null;
	return `${url.origin}${url.pathname}`;
}

function isFontFile(value: string): boolean {
	const url = parseUrl(value);
	if (url === null || url.username !== '' || url.password !== '') return false;
	const pathPrefix = FONT_FILE_PATH_PREFIXES.get(url.origin);
	return pathPrefix !== undefined && url.pathname.startsWith(pathPrefix);
}

function isFontStylesheet(value: string): boolean {
	const url = parseUrl(value);
	return (
		url !== null &&
		FONT_STYLESHEET_ORIGINS.has(url.origin) &&
		url.username === '' &&
		url.password === '' &&
		FONT_STYLESHEET_PATHS.has(url.pathname)
	);
}

function allowedValue(rawValue: string, inFontFace: boolean, policy: ThemeCssGatePolicy): string | null {
	const value = rawValue.trim();
	if (value === REJECTED_CSS_URL) return value;
	if (value.startsWith('#')) return !inFontFace && FRAGMENT_REFERENCE_PATTERN.test(value) ? value : null;
	if (DATA_URL_PATTERN.test(value)) return value;
	if (/^blob:/i.test(value)) return policy.objectUrls.has(value) ? value : null;
	if (inFontFace) return isFontFile(value) ? value : null;
	return canonicalAttachmentUrl(value, policy.mediaEndpoint);
}

function quoteCssString(value: string): string {
	return `"${value.replace(/[\\"\n\r\f]/g, (character) => `\\${character.charCodeAt(0).toString(16)} `)}"`;
}

function tokenName(token: CSSToken): string {
	return (token[4] as {value: string}).value.toLowerCase();
}

function tokenValue(token: CSSToken): string {
	return (token[4] as {value: string}).value;
}

function isValueToken(token: CSSToken): boolean {
	return token[0] === TokenType.String || token[0] === TokenType.URL;
}

function matchingCloseIndex(tokens: ReadonlyArray<CSSToken>, openIndex: number): number {
	const expectedClosers: Array<TokenType> = [];
	for (let index = openIndex; index < tokens.length; index++) {
		const type = tokens[index][0];
		const closer = CLOSER_BY_OPENER.get(type);
		if (closer !== undefined) {
			expectedClosers.push(closer);
		} else if (type === expectedClosers[expectedClosers.length - 1]) {
			expectedClosers.pop();
			if (expectedClosers.length === 0) return index;
		}
	}
	return tokens.length - 1;
}

function importRuleEndIndex(tokens: ReadonlyArray<CSSToken>, ruleIndex: number): number {
	for (let index = ruleIndex; index < tokens.length - 1; index++) {
		const type = tokens[index][0];
		if (type === TokenType.Semicolon || type === TokenType.CloseCurly) return index;
		if (type === TokenType.OpenCurly) return matchingCloseIndex(tokens, index);
		if (CLOSER_BY_OPENER.has(type)) index = matchingCloseIndex(tokens, index);
	}
	return tokens.length - 1;
}

function importTarget(tokens: ReadonlyArray<CSSToken>, ruleIndex: number, endIndex: number): string | null {
	const prelude = tokens
		.slice(ruleIndex + 1, endIndex)
		.filter((token) => token[0] !== TokenType.Whitespace && token[0] !== TokenType.Comment);
	if (prelude.length === 1 && isValueToken(prelude[0])) return tokenValue(prelude[0]);
	if (
		prelude.length === 3 &&
		prelude[0][0] === TokenType.Function &&
		tokenName(prelude[0]) === 'url' &&
		prelude[1][0] === TokenType.String &&
		prelude[2][0] === TokenType.CloseParen
	) {
		return tokenValue(prelude[1]);
	}
	return null;
}

function runGatePass(css: string, policy: ThemeCssGatePolicy): GatePass {
	const tokens = tokenize({css});
	const replacements: Array<Replacement> = [];
	const blocked: Array<string> = [];
	let fontFaceEndIndex = -1;

	const endOffset = (index: number): number => (tokens[index][0] === TokenType.EOF ? css.length : tokens[index][3] + 1);

	const keepValue = (token: CSSToken, inFontFace: boolean): Replacement | null | undefined => {
		const original = tokenValue(token);
		const allowed = allowedValue(original, inFontFace, policy);
		if (allowed === null) return null;
		if (allowed === original) return undefined;
		const text = token[0] === TokenType.URL ? `url(${quoteCssString(allowed)})` : quoteCssString(allowed);
		return {from: token[2], to: token[3] + 1, text};
	};

	const reject = (from: number, to: number, value: string): void => {
		replacements.push({from, to, text: REJECTED_CSS_VALUE});
		blocked.push(value);
	};

	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index];
		const type = token[0];

		if (type === TokenType.AtKeyword) {
			const name = tokenName(token);
			if (name === 'import') {
				const endIndex = importRuleEndIndex(tokens, index);
				const target = importTarget(tokens, index, endIndex);
				if (target === null || !isFontStylesheet(target)) {
					replacements.push({from: token[2], to: endOffset(endIndex), text: ' '});
					blocked.push(target ?? css.slice(token[2], endOffset(endIndex)));
				}
				index = endIndex;
			} else if (name === 'font-face') {
				let blockIndex = index;
				while (
					blockIndex < tokens.length - 1 &&
					tokens[blockIndex][0] !== TokenType.OpenCurly &&
					tokens[blockIndex][0] !== TokenType.Semicolon
				) {
					blockIndex++;
				}
				if (tokens[blockIndex][0] === TokenType.OpenCurly) fontFaceEndIndex = matchingCloseIndex(tokens, blockIndex);
			}
			continue;
		}

		const inFontFace = index <= fontFaceEndIndex;

		if (type === TokenType.BadURL) {
			reject(token[2], token[3] + 1, token[1]);
			continue;
		}

		if (type === TokenType.URL) {
			const kept = keepValue(token, inFontFace);
			if (kept === null) reject(token[2], token[3] + 1, tokenValue(token));
			else if (kept) replacements.push(kept);
			continue;
		}

		if (type !== TokenType.Function || !URL_FUNCTIONS.has(tokenName(token))) continue;

		const closeIndex = matchingCloseIndex(tokens, index);
		const values: Array<CSSToken> = [];
		let refused = tokens[closeIndex][0] !== TokenType.CloseParen;
		for (let inner = index + 1; inner < closeIndex; inner++) {
			const innerToken = tokens[inner];
			const innerType = innerToken[0];
			if (innerType === TokenType.Function) {
				const innerName = tokenName(innerToken);
				if (!FUNCTIONS_ALLOWED_IN_URL_FUNCTIONS.has(innerName)) {
					refused = true;
				} else if (innerName === 'type') {
					const typeCloseIndex = matchingCloseIndex(tokens, inner);
					for (let typeIndex = inner + 1; typeIndex < typeCloseIndex; typeIndex++) {
						const typeToken = tokens[typeIndex][0];
						if (typeToken !== TokenType.String && typeToken !== TokenType.Whitespace) refused = true;
					}
					inner = typeCloseIndex;
				}
			} else if (isValueToken(innerToken)) {
				values.push(innerToken);
			} else if (
				innerType === TokenType.BadURL ||
				innerType === TokenType.BadString ||
				innerType === TokenType.OpenCurly ||
				innerType === TokenType.OpenSquare
			) {
				refused = true;
			}
		}
		if (values.length === 0 && tokenName(token) === 'url') refused = true;
		const urlReplacements: Array<Replacement> = [];
		let refusedValue: string | null = null;
		if (!refused) {
			for (const value of values) {
				const kept = keepValue(value, inFontFace);
				if (kept === null) {
					refused = true;
					refusedValue = tokenValue(value);
					break;
				}
				if (kept) urlReplacements.push(kept);
			}
		}
		if (refused) {
			reject(token[2], endOffset(closeIndex), refusedValue ?? css.slice(token[2], endOffset(closeIndex)));
		} else {
			replacements.push(...urlReplacements);
		}
		index = closeIndex;
	}

	replacements.sort((left, right) => left.from - right.from);
	let output = '';
	let position = 0;
	for (const {from, to, text} of replacements) {
		output += css.slice(position, from) + text;
		position = to;
	}
	output += css.slice(position);
	return {css: output, changed: replacements.length > 0, blocked};
}

function runGate(css: string, policy: ThemeCssGatePolicy): ThemeCssGateResult {
	const pass = runGatePass(css, policy);
	const check = runGatePass(pass.css, policy);
	const rejected = check.changed || check.css !== pass.css;
	return {
		css: rejected ? '' : pass.css,
		rejected,
		blocked: [...new Set(pass.blocked)].filter((value) => value.trim() !== ''),
	};
}

let lastGate: {css: string; policyKey: string; result: ThemeCssGateResult} | null = null;

export function gateThemeCss(css: string, policy: ThemeCssGatePolicy): ThemeCssGateResult {
	const policyKey = JSON.stringify([policy.mediaEndpoint, [...policy.objectUrls]]);
	if (lastGate?.css === css && lastGate.policyKey === policyKey) return lastGate.result;
	const result = runGate(css, policy);
	lastGate = {css, policyKey, result};
	return result;
}
