// SPDX-License-Identifier: AGPL-3.0-or-later

import * as ColorUtils from '@app/features/theme/utils/ColorUtils';
import {ensureNameFontFaces, getNameFont, nameFontFamily} from '@app/features/user/name_style/NameFonts';
import styles from '@app/features/user/name_style/NamePaint.module.css';
import {NameStyleEffects} from '@fluxer/constants/src/NameStyleConstants';
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
				style['--name-glow'] = primary;
			}
		} else if (effect === NameStyleEffects.SHIMMER) {
			classes.push(styles.clipped, styles.shimmer);
			style['--name-c1'] = primary;
			style['--name-c2'] = DEFAULT_SHIMMER_HIGHLIGHT;
		} else {
			style.color = primary;
			if (effect === NameStyleEffects.GLOW) {
				classes.push(styles.glow);
				style['--name-glow'] = primary;
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
				} else if (nameStyle.primary_color !== null) {
					style.color = primary;
				}
				break;
			case NameStyleEffects.GLOW:
				if (nameStyle.primary_color !== null) style.color = primary;
				classes.push(styles.glow);
				style['--name-glow'] = secondary ?? primary;
				break;
			case NameStyleEffects.SHIMMER:
				classes.push(styles.clipped, styles.shimmer);
				style['--name-c1'] = primary;
				style['--name-c2'] = secondary ?? DEFAULT_SHIMMER_HIGHLIGHT;
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
