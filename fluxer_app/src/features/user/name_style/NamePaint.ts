// SPDX-License-Identifier: AGPL-3.0-or-later

import * as ColorUtils from '@app/features/theme/utils/ColorUtils';
import {ensureNameFontFaces, getNameFont, nameFontFamily} from '@app/features/user/name_style/NameFonts';
import styles from '@app/features/user/name_style/NamePaint.module.css';
import {
	DEFAULT_NAME_EFFECT_INTENSITY,
	NameGradientDirections,
	NameStyleEffects,
} from '@fluxer/constants/src/NameStyleConstants';
import type {NameStyle} from '@fluxer/schema/src/domains/user/NameStyleSchemas';
import {clsx} from 'clsx';
import type React from 'react';

export interface NameRolePaint {
	readonly color: number;
	readonly secondaryColor: number | null;
	readonly tertiaryColor: number | null;
}

export interface NamePaintInput {
	nameStyle?: NameStyle | null;
	// The highest coloured role of the member; in a guild its colour replaces the user's colours.
	role?: NameRolePaint | null;
	// A colour the caller forces, for example the colour preview in the role editor.
	colorOverride?: string;
	// The rendered text, used to pick the Turkish letter forms of all-caps fonts.
	text?: string;
}

export interface NamePaint {
	className?: string;
	style?: React.CSSProperties;
	lang?: string;
}

const TURKISH_ONLY_LETTERS = /[ğĞşŞıİ]/;
const DEFAULT_SHIMMER_HIGHLIGHT = '#ffffff';
const EMPTY_PAINT: NamePaint = {};

type CssVars = React.CSSProperties & Record<`--${string}`, string>;

function hex(color: number): string {
	return ColorUtils.int2hex(color);
}

function strength(intensity: number | undefined): number {
	return Math.min(Math.max((intensity ?? DEFAULT_NAME_EFFECT_INTENSITY) / 100, 0), 1);
}

// Two stacked shadows: a tight core and a wide halo, both growing with the intensity.
function applyGlow(style: CssVars, color: string, intensity: number | undefined): void {
	const t = strength(intensity);
	style['--name-glow'] = `color-mix(in srgb, ${color} ${Math.round(55 + 45 * t)}%, transparent)`;
	style['--name-glow-r1'] = `${(0.05 + 0.2 * t).toFixed(3)}em`;
	style['--name-glow-r2'] = `${(0.12 + 0.6 * t).toFixed(3)}em`;
}

// The shine band widens and brightens with the intensity.
function applyShimmer(style: CssVars, base: string, shine: string, intensity: number | undefined): void {
	const t = strength(intensity);
	style['--name-c1'] = base;
	style['--name-c2'] = `color-mix(in srgb, ${shine} ${Math.round(65 + 35 * t)}%, ${base})`;
	style['--name-shine-width'] = `${(7 + 17 * t).toFixed(1)}%`;
}

// Fonts such as Bangers and Cinzel carry dotted capitals only for Turkish (OpenType `locl`).
export function nameLanguage(text: string | undefined): string | undefined {
	return text && TURKISH_ONLY_LETTERS.test(text) ? 'tr' : undefined;
}

export function resolveNamePaint({nameStyle, role, colorOverride, text}: NamePaintInput): NamePaint {
	const classes: Array<string | false | undefined> = [];
	const style: CssVars = {};
	const font = getNameFont(nameStyle?.font);
	if (font) {
		ensureNameFontFaces();
		style.fontFamily = nameFontFamily(font);
		classes.push(styles.font);
	}
	const effect = nameStyle?.effect ?? NameStyleEffects.SOLID;
	const roleColored = !colorOverride && role != null && role.color !== 0;

	if (colorOverride) {
		style.color = colorOverride;
	} else if (roleColored) {
		const primary = hex(role.color);
		if (role.secondaryColor !== null && role.tertiaryColor !== null) {
			classes.push(styles.clipped, styles.holographic);
			style['--name-c1'] = primary;
			style['--name-c2'] = hex(role.secondaryColor);
			style['--name-c3'] = hex(role.tertiaryColor);
		} else if (role.secondaryColor !== null) {
			classes.push(styles.clipped, styles.gradient);
			style['--name-c1'] = primary;
			style['--name-c2'] = hex(role.secondaryColor);
			if (effect === NameStyleEffects.GLOW) {
				classes.push(styles.glow);
				applyGlow(style, primary, nameStyle?.intensity);
			}
		} else if (effect === NameStyleEffects.SHIMMER) {
			classes.push(styles.clipped, styles.shimmer);
			applyShimmer(style, primary, DEFAULT_SHIMMER_HIGHLIGHT, nameStyle?.intensity);
		} else {
			style.color = primary;
			if (effect === NameStyleEffects.GLOW) {
				classes.push(styles.glow);
				applyGlow(style, primary, nameStyle?.intensity);
			}
		}
	} else if (nameStyle) {
		const primary = nameStyle.primary_color !== null ? hex(nameStyle.primary_color) : 'currentColor';
		const secondary = nameStyle.secondary_color !== null ? hex(nameStyle.secondary_color) : null;
		switch (effect) {
			case NameStyleEffects.GRADIENT:
				if (secondary) {
					classes.push(styles.clipped, styles.gradient);
					style['--name-c1'] = primary;
					style['--name-c2'] = secondary;
					if (nameStyle.gradient_direction === NameGradientDirections.VERTICAL) {
						// Letters fill the middle of the line box, so the colour change is kept inside them.
						style['--name-angle'] = '180deg';
						style['--name-stop-a'] = '25%';
						style['--name-stop-b'] = '80%';
					}
				} else if (nameStyle.primary_color !== null) {
					style.color = primary;
				}
				break;
			case NameStyleEffects.GLOW:
				if (nameStyle.primary_color !== null) style.color = primary;
				classes.push(styles.glow);
				applyGlow(style, secondary ?? primary, nameStyle.intensity);
				break;
			case NameStyleEffects.SHIMMER:
				classes.push(styles.clipped, styles.shimmer);
				applyShimmer(style, primary, secondary ?? DEFAULT_SHIMMER_HIGHLIGHT, nameStyle.intensity);
				break;
			default:
				if (nameStyle.primary_color !== null) style.color = primary;
		}
	}

	const className = clsx(classes) || undefined;
	const lang = font ? nameLanguage(text) : undefined;
	if (!className && Object.keys(style).length === 0 && !lang) return EMPTY_PAINT;
	return {className, style, lang};
}

export function memberNamePaint(
	nameStyle: NameStyle | null | undefined,
	member: {getColorRole(): NameRolePaint | undefined} | null | undefined,
	options?: {colorOverride?: string; text?: string},
): NamePaint {
	return resolveNamePaint({
		nameStyle,
		role: member?.getColorRole() ?? null,
		colorOverride: options?.colorOverride,
		text: options?.text,
	});
}
