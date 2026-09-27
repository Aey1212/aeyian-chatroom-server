// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	isProfileFrameId,
	PROFILE_FRAME_IDS,
	PROFILE_THEME_COLOR_COUNT,
	type ProfileFrameId,
} from '@fluxer/constants/src/ProfileCustomizationConstants';
import {ColorType, createNamedStringLiteralUnion} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const ProfileFrameIdSchema = createNamedStringLiteralUnion(
	PROFILE_FRAME_IDS.map((id) => [id, id.toUpperCase()] as const),
	'Id of a profile frame',
);

export const ProfileThemeColorsSchema = z
	.array(ColorType)
	.min(PROFILE_THEME_COLOR_COUNT)
	.max(PROFILE_THEME_COLOR_COUNT)
	.describe('Two colours as integers: the top and the bottom of the profile card');

export type ProfileThemeColors = readonly [number, number];

function isColor(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff;
}

// Stored values are checked on read, so a malformed row or a retired frame id reads as "not set".
export function readProfileThemeColors(value: unknown): ProfileThemeColors | null {
	if (!Array.isArray(value) || value.length !== PROFILE_THEME_COLOR_COUNT) return null;
	const [top, bottom] = value;
	return isColor(top) && isColor(bottom) ? [top, bottom] : null;
}

export function readProfileFrame(value: unknown): ProfileFrameId | null {
	return isProfileFrameId(value) ? value : null;
}
