// SPDX-License-Identifier: AGPL-3.0-or-later

// Frames drawn in code by the app (fluxer_app/src/features/user/profile_style/ProfileFrames.module.css).
export const PROFILE_FRAME_IDS = [
	'aurora',
	'gold',
	'neon',
	'holographic',
	'ember',
	'frost',
	'sakura',
	'midnight',
	'circuit',
	'pixel',
] as const;

export type ProfileFrameId = (typeof PROFILE_FRAME_IDS)[number];

const PROFILE_FRAME_ID_SET = new Set<string>(PROFILE_FRAME_IDS);

export function isProfileFrameId(value: unknown): value is ProfileFrameId {
	return typeof value === 'string' && PROFILE_FRAME_ID_SET.has(value);
}

// A profile theme is two colours: the top of the card and the bottom of the card.
export const PROFILE_THEME_COLOR_COUNT = 2;
