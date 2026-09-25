// SPDX-License-Identifier: AGPL-3.0-or-later

import {PermissionStringType} from '@fluxer/schema/src/primitives/PermissionValidators';
import {
	ColorType,
	createNamedObject,
	Int32Type,
	SnowflakeStringType,
} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const GuildRoleColors = createNamedObject(
	'GuildRoleColors',
	{
		primary_color: ColorType.describe('The main colour of the role as an integer; the same value as `color`'),
		secondary_color: ColorType.nullable().describe(
			'The second colour of a gradient role as an integer, or null for a solid colour',
		),
		tertiary_color: ColorType.nullable().describe(
			'The third colour of a holographic role as an integer. Only set when `secondary_color` is set.',
		),
	},
	'The colours of a role. A secondary colour makes a gradient; a tertiary colour makes it holographic.',
);

export type GuildRoleColors = z.infer<typeof GuildRoleColors>;

export const GuildRoleResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier for this role'),
	name: z.string().describe('The name of the role'),
	color: Int32Type.describe('The colour of the role as an integer'),
	colors: GuildRoleColors.describe('The colours of the role, including gradient and holographic colours'),
	position: Int32Type.describe('The position of the role in the role hierarchy'),
	hoist_position: Int32Type.nullish().describe('The position of the role in the hoisted member list'),
	permissions: PermissionStringType.describe('The permissions bitfield for the role'),
	hoist: z.boolean().describe('Whether this role is displayed separately in the member list'),
	mentionable: z.boolean().describe('Whether this role can be mentioned by anyone'),
	unicode_emoji: z.string().nullish().describe('The unicode emoji for this role'),
});

export type GuildRoleResponse = z.infer<typeof GuildRoleResponse>;

export type GuildRole = Readonly<GuildRoleResponse>;

export const GuildRoleListResponse = z.array(GuildRoleResponse);
