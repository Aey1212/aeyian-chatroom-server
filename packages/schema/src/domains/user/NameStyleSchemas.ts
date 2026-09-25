// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	isNameFontId,
	isNameStyleEffect,
	NAME_FONT_IDS,
	type NameFontId,
	type NameStyleEffect,
	NameStyleEffects,
} from '@fluxer/constants/src/NameStyleConstants';
import {
	ColorType,
	createNamedObject,
	createNamedStringLiteralUnion,
} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import type {z} from 'zod';

export const NameFontIdSchema = createNamedStringLiteralUnion(
	NAME_FONT_IDS.map((id) => [id, id.replace(/-/g, '_').toUpperCase()] as const),
	'Id of a display-name font',
);

export const NameStyleEffectSchema = createNamedStringLiteralUnion(
	[
		[NameStyleEffects.SOLID, 'SOLID', 'One color'],
		[NameStyleEffects.GRADIENT, 'GRADIENT', 'A gradient from the primary to the secondary color'],
		[NameStyleEffects.GLOW, 'GLOW', 'The primary color with a glow in the secondary color'],
		[NameStyleEffects.SHIMMER, 'SHIMMER', 'The primary color with a light sweep in the secondary color'],
	],
	'How the display name is painted',
);

export const NameStyleSchema = createNamedObject(
	'NameStyle',
	{
		font: NameFontIdSchema.nullable().describe('Font for the display name, or null for the app font'),
		effect: NameStyleEffectSchema.describe('How the display name is painted'),
		primary_color: ColorType.nullable().describe('Main color as an integer, or null for the default text color'),
		secondary_color: ColorType.nullable().describe(
			'Second color as an integer, used by the gradient, glow and shimmer effects',
		),
	},
	'Font, colors and effect of a display name',
);

export type NameStyle = z.infer<typeof NameStyleSchema>;

function colorOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff ? value : null;
}

export function normalizeNameStyle(value: NameStyle | null | undefined): NameStyle | null {
	if (!value) return null;
	const isDefault =
		value.font === null &&
		value.effect === NameStyleEffects.SOLID &&
		value.primary_color === null &&
		value.secondary_color === null;
	return isDefault ? null : value;
}

// Stored rows are JSON text; anything unreadable (for example a font that was removed) falls back to defaults.
export function parseStoredNameStyle(stored: string | null | undefined): NameStyle | null {
	if (!stored) return null;
	let raw: unknown;
	try {
		raw = JSON.parse(stored);
	} catch {
		return null;
	}
	if (raw === null || typeof raw !== 'object') return null;
	const record = raw as Record<string, unknown>;
	const font: NameFontId | null = isNameFontId(record.font) ? record.font : null;
	const effect: NameStyleEffect = isNameStyleEffect(record.effect) ? record.effect : NameStyleEffects.SOLID;
	return normalizeNameStyle({
		font,
		effect,
		primary_color: colorOrNull(record.primary_color),
		secondary_color: colorOrNull(record.secondary_color),
	});
}

export function sameNameStyle(a: NameStyle | null | undefined, b: NameStyle | null | undefined): boolean {
	if (!a || !b) return !a && !b;
	return (
		a.font === b.font &&
		a.effect === b.effect &&
		a.primary_color === b.primary_color &&
		a.secondary_color === b.secondary_color
	);
}

export function serializeNameStyle(style: NameStyle | null): string | null {
	const normalized = normalizeNameStyle(style);
	if (!normalized) return null;
	return JSON.stringify({
		font: normalized.font,
		effect: normalized.effect,
		primary_color: normalized.primary_color,
		secondary_color: normalized.secondary_color,
	});
}
