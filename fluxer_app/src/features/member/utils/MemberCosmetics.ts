// SPDX-License-Identifier: AGPL-3.0-or-later

import {GuildMemberProfileFlags} from '@fluxer/constants/src/GuildConstants';
import type {NameStyle} from '@fluxer/schema/src/domains/user/NameStyleSchemas';
import type {ProfileThemeColors} from '@fluxer/schema/src/domains/user/ProfileStyleSchemas';

// The community side of a profile cosmetic: a member record, or nothing outside a community.
export interface MemberCosmeticSource {
	readonly profileFlags?: number;
	readonly nameStyle?: NameStyle | null;
	readonly avatarFrame?: string | null;
	readonly nameplate?: string | null;
	readonly themeColors?: ProfileThemeColors | ReadonlyArray<number> | null;
	readonly profileFrame?: string | null;
}

// What shows in a community: none when the member chose None there, else the community value, else the global one.
function resolve<T>(
	member: MemberCosmeticSource | null | undefined,
	noneFlag: number,
	memberValue: T | null | undefined,
	globalValue: T | null | undefined,
): T | null {
	if (!member) return globalValue ?? null;
	if (((member.profileFlags ?? 0) & noneFlag) !== 0) return null;
	return memberValue ?? globalValue ?? null;
}

export function effectiveNameStyle(
	globalValue: NameStyle | null | undefined,
	member: MemberCosmeticSource | null | undefined,
): NameStyle | null {
	return resolve(member, GuildMemberProfileFlags.NAME_STYLE_UNSET, member?.nameStyle, globalValue);
}

export function effectiveAvatarFrame(
	globalValue: string | null | undefined,
	member: MemberCosmeticSource | null | undefined,
): string | null {
	return resolve(member, GuildMemberProfileFlags.AVATAR_FRAME_UNSET, member?.avatarFrame, globalValue);
}

export function effectiveNameplate(
	globalValue: string | null | undefined,
	member: MemberCosmeticSource | null | undefined,
): string | null {
	return resolve(member, GuildMemberProfileFlags.NAMEPLATE_UNSET, member?.nameplate, globalValue);
}

export function effectiveThemeColors(
	globalValue: ReadonlyArray<number> | null | undefined,
	member: MemberCosmeticSource | null | undefined,
): ReadonlyArray<number> | null {
	return resolve<ReadonlyArray<number>>(
		member,
		GuildMemberProfileFlags.THEME_COLORS_UNSET,
		member?.themeColors,
		globalValue,
	);
}

export function effectiveProfileFrame(
	globalValue: string | null | undefined,
	member: MemberCosmeticSource | null | undefined,
): string | null {
	return resolve(member, GuildMemberProfileFlags.PROFILE_FRAME_UNSET, member?.profileFrame, globalValue);
}
