// SPDX-License-Identifier: AGPL-3.0-or-later

import {GuildMemberProfileFlags, GuildMemberProfileFlagsDescriptions} from '@fluxer/constants/src/GuildConstants';
import {CosmeticRefType} from '@fluxer/schema/src/domains/cosmetics/CosmeticSchemas';
import {type NameStyle, NameStyleSchema} from '@fluxer/schema/src/domains/user/NameStyleSchemas';
import {ProfileFrameIdSchema, ProfileThemeColorsSchema} from '@fluxer/schema/src/domains/user/ProfileStyleSchemas';
import {UserPartialResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {
	createBitflagInt32Type,
	Int32Type,
	SnowflakeStringType,
	withFieldDescription,
} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {MentionReplyPreferencesSchema} from '@fluxer/schema/src/primitives/UserSettingsValidators';
import {z} from 'zod';

export const GuildMemberResponse = z.object({
	user: z.lazy(() => UserPartialResponse).describe('The user this guild member represents'),
	nick: z.string().nullish().describe('The nickname of the member in this guild'),
	avatar: z.string().nullish().describe('The hash of the member guild-specific avatar'),
	banner: z.string().nullish().describe('The hash of the member guild-specific banner'),
	accent_color: Int32Type.nullish().describe('The accent colour of the member guild profile as an integer'),
	roles: z.array(z.string()).max(250).describe('Array of role IDs the member has'),
	joined_at: z.iso.datetime().describe('ISO8601 timestamp of when the user joined the guild'),
	mute: z.boolean().describe('Whether the member is muted in voice channels'),
	deaf: z.boolean().describe('Whether the member is deafened in voice channels'),
	communication_disabled_until: z.iso
		.datetime()
		.nullish()
		.describe('ISO8601 timestamp until which the member is timed out'),
	profile_flags: createBitflagInt32Type(
		GuildMemberProfileFlags,
		GuildMemberProfileFlagsDescriptions,
		'Member profile flags',
		'GuildMemberProfileFlags',
	).nullish(),
	mention_flags: withFieldDescription(
		MentionReplyPreferencesSchema,
		'Per-guild reply mention preference override; NO_PREFERENCE means inherit the user-level mention_flags.',
	).nullish(),
	name_style: NameStyleSchema.optional().describe(
		'Display name style in this guild. Omitted when the user name style applies (or none, see profile_flags).',
	),
	avatar_frame: CosmeticRefType.optional().describe(
		'Avatar frame in this guild. Omitted when the user avatar frame applies (or none, see profile_flags).',
	),
	nameplate: CosmeticRefType.optional().describe(
		'Nameplate in this guild. Omitted when the user nameplate applies (or none, see profile_flags).',
	),
	theme_colors: ProfileThemeColorsSchema.optional().describe(
		'Profile theme colours in this guild, top then bottom. Omitted when the user theme applies (or none, see profile_flags).',
	),
	profile_frame: ProfileFrameIdSchema.optional().describe(
		'Profile frame in this guild. Omitted when the user profile frame applies (or none, see profile_flags).',
	),
});

export type GuildMemberResponse = z.infer<typeof GuildMemberResponse>;

export const GuildBanResponse = z.object({
	user: z.lazy(() => UserPartialResponse).describe('The banned user'),
	reason: z.string().nullish().describe('The reason for the ban'),
	moderator_id: SnowflakeStringType.describe('The ID of the moderator who issued the ban'),
	banned_at: z.iso.datetime().describe('ISO8601 timestamp of when the ban was issued'),
	expires_at: z.iso.datetime().nullish().describe('ISO8601 timestamp of when the ban expires (null if permanent)'),
});

export type GuildBanResponse = z.infer<typeof GuildBanResponse>;

export interface GuildMemberData {
	readonly user: UserPartialResponse;
	readonly nick?: string | null;
	readonly avatar?: string | null;
	readonly banner?: string | null;
	readonly accent_color?: number | null;
	readonly roles: ReadonlyArray<string>;
	readonly joined_at: string;
	readonly mute?: boolean;
	readonly deaf?: boolean;
	readonly communication_disabled_until?: string | null;
	readonly profile_flags?: number | null;
	readonly mention_flags?: number | null;
	readonly name_style?: NameStyle | null;
	readonly avatar_frame?: string | null;
	readonly nameplate?: string | null;
	readonly theme_colors?: ReadonlyArray<number> | null;
	readonly profile_frame?: string | null;
}

export const GuildMemberListResponse = z.array(GuildMemberResponse);
export const GuildBanListResponse = z.array(GuildBanResponse);
