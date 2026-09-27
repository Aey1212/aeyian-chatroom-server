// SPDX-License-Identifier: AGPL-3.0-or-later

import {getPolicy} from '@fluxer/constants/src/AssetFormatPolicy';
import {
	COSMETIC_ID_MAX_LENGTH,
	COSMETIC_NAME_MAX_LENGTH,
	COSMETIC_NAME_MIN_LENGTH,
	CosmeticKinds,
} from '@fluxer/constants/src/CosmeticConstants';
import {base64LengthForBytes, createBase64StringType} from '@fluxer/schema/src/primitives/FileValidators';
import {
	createNamedStringLiteralUnion,
	createStringType,
	SnowflakeStringType,
	SnowflakeType,
} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const CosmeticKindSchema = createNamedStringLiteralUnion(
	[
		[CosmeticKinds.AVATAR_FRAME, 'AVATAR_FRAME', 'A decoration drawn around the round avatar'],
		[CosmeticKinds.NAMEPLATE, 'NAMEPLATE', 'A background behind the name in the member and DM lists'],
	],
	'The kind of a cosmetic',
);

// A cosmetic reference on a user: a built-in id drawn by the app, or an uploaded cosmetic's snowflake.
export const CosmeticRefType = createStringType(1, COSMETIC_ID_MAX_LENGTH).describe(
	'A built-in cosmetic id (a lowercase word) or the snowflake of an uploaded cosmetic',
);

export const CosmeticResponse = z.object({
	id: SnowflakeStringType.describe('The ID of the uploaded cosmetic'),
	kind: CosmeticKindSchema.describe('Whether this is an avatar frame or a nameplate'),
	name: z.string().describe('The display name of the cosmetic'),
	animated: z.boolean().describe('Whether the image is animated'),
});

export type CosmeticResponse = z.infer<typeof CosmeticResponse>;

export const CosmeticListResponse = z.object({
	cosmetics: z.array(CosmeticResponse).describe('Every uploaded avatar frame and nameplate, newest first'),
});

export type CosmeticListResponse = z.infer<typeof CosmeticListResponse>;

export const AdminCosmeticResponse = CosmeticResponse.extend({
	creator_id: SnowflakeStringType.describe('The admin who uploaded the cosmetic'),
	created_at: z.iso.datetime().describe('ISO8601 timestamp of the upload'),
});

export type AdminCosmeticResponse = z.infer<typeof AdminCosmeticResponse>;

export const AdminCosmeticListResponse = z.object({
	cosmetics: z.array(AdminCosmeticResponse).describe('Every uploaded cosmetic, newest first'),
});

export type AdminCosmeticListResponse = z.infer<typeof AdminCosmeticListResponse>;

export const AdminCosmeticCreateRequest = z.object({
	kind: CosmeticKindSchema.describe('Whether the image is an avatar frame or a nameplate'),
	name: createStringType(COSMETIC_NAME_MIN_LENGTH, COSMETIC_NAME_MAX_LENGTH).describe(
		`The display name of the cosmetic (${COSMETIC_NAME_MIN_LENGTH}-${COSMETIC_NAME_MAX_LENGTH} characters)`,
	),
	image: createBase64StringType(1, base64LengthForBytes(getPolicy('cosmetic').maxBytes)).describe(
		'Base64-encoded image. An avatar frame is square with a transparent centre; a nameplate is at least twice as wide as it is tall.',
	),
});

export type AdminCosmeticCreateRequest = z.infer<typeof AdminCosmeticCreateRequest>;

export const AdminCosmeticDeleteResponse = z.object({
	deleted: z.boolean().describe('Whether a cosmetic with this ID existed and was removed'),
});

export type AdminCosmeticDeleteResponse = z.infer<typeof AdminCosmeticDeleteResponse>;

export const CosmeticIdParam = z.object({
	cosmetic_id: SnowflakeType.describe('The ID of the uploaded cosmetic'),
});
