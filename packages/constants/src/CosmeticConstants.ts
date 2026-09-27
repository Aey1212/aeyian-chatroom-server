// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ValueOf} from '@fluxer/constants/src/ValueOf';

export const CosmeticKinds = {
	AVATAR_FRAME: 'avatar_frame',
	NAMEPLATE: 'nameplate',
} as const;

export type CosmeticKind = ValueOf<typeof CosmeticKinds>;

// Drawn in code by the app (fluxer_app/src/features/user/cosmetics/). Uploaded cosmetics use snowflake ids.
export const BUILTIN_AVATAR_FRAME_IDS = [
	'halo',
	'neon',
	'rainbow',
	'flames',
	'frost',
	'sakura',
	'orbit',
	'galaxy',
] as const;

export const BUILTIN_NAMEPLATE_IDS = [
	'aurora',
	'sunset',
	'ocean',
	'galaxy',
	'sakura',
	'circuit',
	'ember',
	'mint',
] as const;

export type BuiltinAvatarFrameId = (typeof BUILTIN_AVATAR_FRAME_IDS)[number];
export type BuiltinNameplateId = (typeof BUILTIN_NAMEPLATE_IDS)[number];

const BUILTIN_IDS: Readonly<Record<CosmeticKind, ReadonlySet<string>>> = {
	avatar_frame: new Set(BUILTIN_AVATAR_FRAME_IDS),
	nameplate: new Set(BUILTIN_NAMEPLATE_IDS),
};

export function isBuiltinCosmeticId(kind: CosmeticKind, id: unknown): boolean {
	return typeof id === 'string' && BUILTIN_IDS[kind].has(id);
}

// Uploaded cosmetic ids are snowflakes; built-in ids are lowercase words.
export function isUploadedCosmeticId(id: unknown): id is string {
	return typeof id === 'string' && /^[1-9]\d{0,19}$/.test(id);
}

export const COSMETIC_ID_MAX_LENGTH = 20;
export const COSMETIC_NAME_MIN_LENGTH = 1;
export const COSMETIC_NAME_MAX_LENGTH = 32;
