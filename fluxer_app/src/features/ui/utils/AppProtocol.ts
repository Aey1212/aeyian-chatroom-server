// SPDX-License-Identifier: AGPL-3.0-or-later

// Our own link scheme, so links open Aeyian Chatline rather than an official Fluxer install.
export const APP_PROTOCOL = 'chatline';
export const APP_PROTOCOL_SCHEME = `${APP_PROTOCOL}:`;
export const APP_PROTOCOL_PREFIX = `${APP_PROTOCOL}://`;
// Upstream Fluxer's scheme. Links already written with it keep working for now; the app never creates new ones.
// To be phased out (Aey, 2026-11-06).
export const LEGACY_APP_PROTOCOL_SCHEME = 'fluxer:';
export const APP_PROTOCOL_SCHEMES: ReadonlyArray<string> = [APP_PROTOCOL_SCHEME, LEGACY_APP_PROTOCOL_SCHEME];

export function isAppProtocolScheme(scheme: string): boolean {
	return APP_PROTOCOL_SCHEMES.includes(scheme.toLowerCase());
}

// Length of the app scheme ("chatline:" or "fluxer:") that `text` has at `index`, or 0 when it has none.
export function appProtocolSchemeLengthAt(text: string, index = 0): number {
	for (const scheme of APP_PROTOCOL_SCHEMES) {
		if (text.startsWith(scheme, index)) return scheme.length;
	}
	return 0;
}

export function isAppProtocolUrl(url: string): boolean {
	const lowerUrl = url.toLowerCase();
	const scheme = APP_PROTOCOL_SCHEMES.find((candidate) => lowerUrl.startsWith(candidate));
	if (!scheme || url.length <= scheme.length) return false;
	try {
		return isAppProtocolScheme(new URL(url).protocol);
	} catch {
		return true;
	}
}
