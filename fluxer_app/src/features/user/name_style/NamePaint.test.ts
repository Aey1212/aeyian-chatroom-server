// SPDX-License-Identifier: AGPL-3.0-or-later

import {getNameFont, NAME_FONTS} from '@app/features/user/name_style/NameFonts';
import {nameLanguage, resolveNamePaint} from '@app/features/user/name_style/NamePaint';
import {NAME_FONT_IDS} from '@fluxer/constants/src/NameStyleConstants';
import {
	type NameStyle,
	type NameStyleRequest,
	normalizeNameStyle,
} from '@fluxer/schema/src/domains/user/NameStyleSchemas';
import {describe, expect, it} from 'vitest';

type Vars = Record<string, string | undefined>;

function style(request: NameStyleRequest): NameStyle {
	const normalized = normalizeNameStyle(request);
	if (!normalized) throw new Error('expected a non-default style');
	return normalized;
}

function vars(style: object | undefined): Vars {
	return (style ?? {}) as Vars;
}

describe('name fonts', () => {
	it('ships every font id the server accepts, in the same order', () => {
		expect(NAME_FONTS.map((font) => font.id)).toEqual([...NAME_FONT_IDS]);
	});

	it('never labels a script as including Turkish', () => {
		for (const font of NAME_FONTS) {
			expect(font.label).not.toMatch(/turkish/i);
		}
	});

	it('resolves unknown ids to no font', () => {
		expect(getNameFont('comic-sans')).toBeUndefined();
		expect(getNameFont(null)).toBeUndefined();
	});
});

describe('resolveNamePaint', () => {
	it('returns an empty paint for the default style', () => {
		expect(resolveNamePaint({nameStyle: null, text: 'aey'})).toEqual({});
	});

	it('uses the font family with the app font as fallback', () => {
		const paint = resolveNamePaint({
			nameStyle: style({font: 'bangers', effect: 'solid', primary_color: null, secondary_color: null}),
			text: 'aey',
		});
		expect(paint.style?.fontFamily).toBe("'NameFont-bangers', var(--font-sans)");
		expect(paint.style?.color).toBeUndefined();
	});

	it('marks names with Turkish-only letters as Turkish so caps fonts keep the dotted İ', () => {
		expect(nameLanguage('Şahin')).toBe('tr');
		expect(nameLanguage('İnce')).toBe('tr');
		expect(nameLanguage('Yağmur')).toBe('tr');
		expect(nameLanguage('Güçlü')).toBeUndefined();
		const paint = resolveNamePaint({
			nameStyle: style({font: 'cinzel', effect: 'solid', primary_color: null, secondary_color: null}),
			text: 'Şahin',
		});
		expect(paint.lang).toBe('tr');
	});

	it('paints a user gradient with both colors', () => {
		const paint = resolveNamePaint({
			nameStyle: style({font: null, effect: 'gradient', primary_color: 0xff0000, secondary_color: 0x0000ff}),
		});
		expect(vars(paint.style)['--name-c1']).toBe('#ff0000');
		expect(vars(paint.style)['--name-c2']).toBe('#0000ff');
	});

	it('lets a solid role color replace the user colors but keep the font', () => {
		const paint = resolveNamePaint({
			nameStyle: style({font: 'lobster', effect: 'gradient', primary_color: 0xff0000, secondary_color: 0x0000ff}),
			role: {color: 0x00ff00, secondaryColor: null, tertiaryColor: null},
		});
		expect(paint.style?.color).toBe('#00ff00');
		expect(vars(paint.style)['--name-c2']).toBeUndefined();
		expect(paint.style?.fontFamily).toContain('NameFont-lobster');
	});

	it('paints a holographic role with its three colors', () => {
		const paint = resolveNamePaint({
			role: {color: 0xa9c9ff, secondaryColor: 0xffbbec, tertiaryColor: 0xffc3a0},
		});
		expect(vars(paint.style)['--name-c1']).toBe('#a9c9ff');
		expect(vars(paint.style)['--name-c2']).toBe('#ffbbec');
		expect(vars(paint.style)['--name-c3']).toBe('#ffc3a0');
	});

	it('keeps the user glow on top of a role color', () => {
		const paint = resolveNamePaint({
			nameStyle: style({font: null, effect: 'glow', primary_color: 0xff0000, secondary_color: 0x0000ff}),
			role: {color: 0x00ff00, secondaryColor: null, tertiaryColor: null},
		});
		expect(paint.style?.color).toBe('#00ff00');
		expect(vars(paint.style)['--name-glow']).toContain('#00ff00');
	});

	it('ignores a zero role color, which means the role has no color', () => {
		const paint = resolveNamePaint({
			nameStyle: style({font: null, effect: 'solid', primary_color: 0x123456, secondary_color: null}),
			role: {color: 0, secondaryColor: null, tertiaryColor: null},
		});
		expect(paint.style?.color).toBe('#123456');
	});

	it('turns a vertical gradient top to bottom inside the letters', () => {
		const paint = resolveNamePaint({
			nameStyle: style({
				font: null,
				effect: 'gradient',
				primary_color: 0xff0000,
				secondary_color: 0x0000ff,
				gradient_direction: 'vertical',
			}),
		});
		expect(vars(paint.style)['--name-angle']).toBe('180deg');
		expect(vars(paint.style)['--name-stop-a']).toBe('25%');
	});

	it('grows the glow with the intensity', () => {
		const glow = (intensity: number) =>
			vars(
				resolveNamePaint({
					nameStyle: style({font: null, effect: 'glow', primary_color: null, secondary_color: 0x00ff00, intensity}),
				}).style,
			);
		expect(Number.parseFloat(glow(100)['--name-glow-r2'] ?? '0')).toBeGreaterThan(
			Number.parseFloat(glow(10)['--name-glow-r2'] ?? '0'),
		);
		expect(glow(100)['--name-glow']).toContain('#00ff00 100%');
	});

	it('widens the shimmer shine with the intensity', () => {
		const shine = (intensity: number) =>
			Number.parseFloat(
				vars(
					resolveNamePaint({
						nameStyle: style({
							font: null,
							effect: 'shimmer',
							primary_color: 0x123456,
							secondary_color: null,
							intensity,
						}),
					}).style,
				)['--name-shine-width'] ?? '0',
			);
		expect(shine(100)).toBeGreaterThan(shine(0));
	});

	it('lets a forced color win over everything', () => {
		const paint = resolveNamePaint({
			nameStyle: style({font: null, effect: 'shimmer', primary_color: 0x123456, secondary_color: null}),
			role: {color: 0x00ff00, secondaryColor: 0xffffff, tertiaryColor: null},
			colorOverride: 'rgb(1, 2, 3)',
		});
		expect(paint.style?.color).toBe('rgb(1, 2, 3)');
		expect(vars(paint.style)['--name-c1']).toBeUndefined();
	});
});
