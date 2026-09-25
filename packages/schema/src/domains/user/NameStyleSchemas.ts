// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	DEFAULT_NAME_EFFECT_INTENSITY,
	isNameFontId,
	isNameGradientDirection,
	isNameStyleEffect,
	NAME_EFFECT_INTENSITY_MAX,
	NAME_EFFECT_INTENSITY_MIN,
	NAME_FONT_IDS,
	type NameFontId,
	type NameGradientDirection,
	NameGradientDirections,
	type NameStyleEffect,
	NameStyleEffects,
} from '@fluxer/constants/src/NameStyleConstants';
import {
	ColorType,
	createNamedObject,
	createNamedStringLiteralUnion,
} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

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

export const NameGradientDirectionSchema = createNamedStringLiteralUnion(
	[
		[NameGradientDirections.HORIZONTAL, 'HORIZONTAL', 'From the start of the name to its end'],
		[NameGradientDirections.VERTICAL, 'VERTICAL', 'From the top of the letters to their bottom'],
	],
	'Direction of a gradient display name',
);

const NameEffectIntensityType = z
	.number()
	.int()
	.min(NAME_EFFECT_INTENSITY_MIN)
	.max(NAME_EFFECT_INTENSITY_MAX)
	.describe('Strength of the glow and shimmer effects, 0-100');

const NAME_STYLE_FIELDS = {
	font: NameFontIdSchema.nullable().describe('Font for the display name, or null for the app font'),
	effect: NameStyleEffectSchema.describe('How the display name is painted'),
	primary_color: ColorType.nullable().describe('Main color as an integer, or null for the default text color'),
	secondary_color: ColorType.nullable().describe(
		'Second color as an integer, used by the gradient, glow and shimmer effects',
	),
};

export const NameStyleSchema = createNamedObject(
	'NameStyle',
	{
		...NAME_STYLE_FIELDS,
		gradient_direction: NameGradientDirectionSchema.describe('Direction of the gradient effect'),
		intensity: NameEffectIntensityType,
	},
	'Font, colors and effect of a display name',
);

export type NameStyle = z.infer<typeof NameStyleSchema>;

export const NameStyleRequestSchema = createNamedObject(
	'NameStyleRequest',
	{
		...NAME_STYLE_FIELDS,
		gradient_direction: NameGradientDirectionSchema.optional().describe(
			'Direction of the gradient effect (default horizontal)',
		),
		intensity: NameEffectIntensityType.optional().describe(
			`Strength of the glow and shimmer effects, 0-100 (default ${DEFAULT_NAME_EFFECT_INTENSITY})`,
		),
	},
	'Font, colors and effect of a display name',
);

export type NameStyleRequest = z.infer<typeof NameStyleRequestSchema>;

function colorOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff ? value : null;
}

function intensityOrDefault(value: unknown): number {
	return typeof value === 'number' &&
		Number.isInteger(value) &&
		value >= NAME_EFFECT_INTENSITY_MIN &&
		value <= NAME_EFFECT_INTENSITY_MAX
		? value
		: DEFAULT_NAME_EFFECT_INTENSITY;
}

// Fills the optional fields and returns null for the default style (app font, solid, no colours).
export function normalizeNameStyle(value: NameStyleRequest | null | undefined): NameStyle | null {
	if (!value) return null;
	const isDefault =
		value.font === null &&
		value.effect === NameStyleEffects.SOLID &&
		value.primary_color === null &&
		value.secondary_color === null;
	if (isDefault) return null;
	return {
		font: value.font,
		effect: value.effect,
		primary_color: value.primary_color,
		secondary_color: value.secondary_color,
		gradient_direction: value.gradient_direction ?? NameGradientDirections.HORIZONTAL,
		intensity: value.intensity ?? DEFAULT_NAME_EFFECT_INTENSITY,
	};
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
	const direction: NameGradientDirection = isNameGradientDirection(record.gradient_direction)
		? record.gradient_direction
		: NameGradientDirections.HORIZONTAL;
	return normalizeNameStyle({
		font,
		effect,
		primary_color: colorOrNull(record.primary_color),
		secondary_color: colorOrNull(record.secondary_color),
		gradient_direction: direction,
		intensity: intensityOrDefault(record.intensity),
	});
}

export function sameNameStyle(a: NameStyle | null | undefined, b: NameStyle | null | undefined): boolean {
	if (!a || !b) return !a && !b;
	return (
		a.font === b.font &&
		a.effect === b.effect &&
		a.primary_color === b.primary_color &&
		a.secondary_color === b.secondary_color &&
		a.gradient_direction === b.gradient_direction &&
		a.intensity === b.intensity
	);
}

export function serializeNameStyle(style: NameStyleRequest | null): string | null {
	const normalized = normalizeNameStyle(style);
	if (!normalized) return null;
	return JSON.stringify({
		font: normalized.font,
		effect: normalized.effect,
		primary_color: normalized.primary_color,
		secondary_color: normalized.secondary_color,
		gradient_direction: normalized.gradient_direction,
		intensity: normalized.intensity,
	});
}
