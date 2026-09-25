// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ValueOf} from '@fluxer/constants/src/ValueOf';

// Same ids, same order as tools/fonts/build_name_fonts.py; its --verify fails when they drift.
export const NAME_FONT_IDS = [
	'noto-sans',
	'nunito',
	'rubik',
	'poppins',
	'space-grotesk',
	'exo-2',
	'comfortaa',
	'righteous',
	'audiowide',
	'bangers',
	'pacifico',
	'lobster',
	'caveat',
	'dancing-script',
	'playfair-display',
	'cinzel',
	'press-start-2p',
	'vt323',
	'jetbrains-mono',
	'm-plus-rounded-1c',
	'zen-maru-gothic',
	'klee-one',
	'do-hyeon',
	'black-han-sans',
	'gowun-dodum',
	'zcool-kuaile',
	'ma-shan-zheng',
	'lxgw-wenkai-tc',
	'cairo',
	'kanit',
	'reem-kufi',
	'gfs-didot',
	'kelly-slab',
] as const;

export type NameFontId = (typeof NAME_FONT_IDS)[number];

const NAME_FONT_ID_SET = new Set<string>(NAME_FONT_IDS);

export function isNameFontId(value: unknown): value is NameFontId {
	return typeof value === 'string' && NAME_FONT_ID_SET.has(value);
}

export const NameStyleEffects = {
	SOLID: 'solid',
	GRADIENT: 'gradient',
	GLOW: 'glow',
	SHIMMER: 'shimmer',
} as const;

export type NameStyleEffect = ValueOf<typeof NameStyleEffects>;

export const NAME_STYLE_EFFECTS = Object.values(NameStyleEffects) as ReadonlyArray<NameStyleEffect>;

export function isNameStyleEffect(value: unknown): value is NameStyleEffect {
	return typeof value === 'string' && (NAME_STYLE_EFFECTS as ReadonlyArray<string>).includes(value);
}

export const NameGradientDirections = {
	HORIZONTAL: 'horizontal',
	VERTICAL: 'vertical',
} as const;

export type NameGradientDirection = ValueOf<typeof NameGradientDirections>;

export function isNameGradientDirection(value: unknown): value is NameGradientDirection {
	return value === NameGradientDirections.HORIZONTAL || value === NameGradientDirections.VERTICAL;
}

// Strength of the glow and shimmer effects, 0-100.
export const NAME_EFFECT_INTENSITY_MIN = 0;
export const NAME_EFFECT_INTENSITY_MAX = 100;
export const DEFAULT_NAME_EFFECT_INTENSITY = 60;
