// SPDX-License-Identifier: AGPL-3.0-or-later

import {Logger} from '@app/features/platform/utils/AppLogger';
import {loadLazyModule} from '@app/features/platform/utils/LazyModuleLoader';
import type {NameFontId} from '@fluxer/constants/src/NameStyleConstants';
import manifest from '@fluxer/fonts/name-fonts/manifest.json';

const logger = new Logger('NameFonts');

export type NameFontScript =
	| 'latin'
	| 'latin_ext'
	| 'cyrillic'
	| 'greek'
	| 'vietnamese'
	| 'arabic'
	| 'hebrew'
	| 'thai'
	| 'devanagari'
	| 'japanese'
	| 'korean'
	| 'chinese_simplified'
	| 'chinese_traditional';

export type NameFontCategory = 'sans' | 'serif' | 'display' | 'handwriting' | 'pixel' | 'mono';

export interface NameFont {
	readonly id: NameFontId;
	readonly label: string;
	readonly category: NameFontCategory;
	readonly family: string;
	readonly scripts: ReadonlyArray<NameFontScript>;
}

// tools/fonts/build_name_fonts.py writes the manifest from the same id list as NAME_FONT_IDS.
export const NAME_FONTS: ReadonlyArray<NameFont> = manifest.fonts as ReadonlyArray<NameFont>;

const FONTS_BY_ID = new Map<string, NameFont>(NAME_FONTS.map((font) => [font.id, font]));

export function getNameFont(id: string | null | undefined): NameFont | undefined {
	return id ? FONTS_BY_ID.get(id) : undefined;
}

export function nameFontFamily(font: NameFont): string {
	return `'${font.family}', var(--font-sans)`;
}

let facesRequested = false;

// The stylesheet only declares faces; a browser downloads a font file once text actually uses it.
export function ensureNameFontFaces(): void {
	if (facesRequested) return;
	facesRequested = true;
	loadLazyModule(() => import('@app/features/user/name_style/NameFontFaces')).catch((error: unknown) => {
		facesRequested = false;
		logger.warn('Failed to load the name font faces; names fall back to the app font:', error);
	});
}
