// SPDX-License-Identifier: AGPL-3.0-or-later

import type {MemberCosmeticSource} from '@app/features/member/utils/MemberCosmetics';
import type {CommunityCosmeticMode} from '@app/features/user/components/modals/tabs/my_profile_tab/CommunityCosmeticModeChoice';
import {GuildMemberProfileFlags} from '@fluxer/constants/src/GuildConstants';
import type {NameStyle} from '@fluxer/schema/src/domains/user/NameStyleSchemas';

export type CommunityCosmeticKey = 'name_style' | 'avatar_frame' | 'nameplate' | 'theme_colors' | 'profile_frame';

export type CommunityCosmeticModes = Record<CommunityCosmeticKey, CommunityCosmeticMode>;

export interface CommunityCosmeticValues {
	name_style: NameStyle | null;
	avatar_frame: string | null;
	nameplate: string | null;
	theme_colors: ReadonlyArray<number> | null;
	profile_frame: string | null;
}

const COMMUNITY_COSMETIC_KEYS: ReadonlyArray<CommunityCosmeticKey> = [
	'name_style',
	'avatar_frame',
	'nameplate',
	'theme_colors',
	'profile_frame',
];

const UNSET_FLAGS: Record<CommunityCosmeticKey, number> = {
	name_style: GuildMemberProfileFlags.NAME_STYLE_UNSET,
	avatar_frame: GuildMemberProfileFlags.AVATAR_FRAME_UNSET,
	nameplate: GuildMemberProfileFlags.NAMEPLATE_UNSET,
	theme_colors: GuildMemberProfileFlags.THEME_COLORS_UNSET,
	profile_frame: GuildMemberProfileFlags.PROFILE_FRAME_UNSET,
};

export const INHERIT_ALL_COMMUNITY_COSMETICS: CommunityCosmeticModes = {
	name_style: 'inherit',
	avatar_frame: 'inherit',
	nameplate: 'inherit',
	theme_colors: 'inherit',
	profile_frame: 'inherit',
};

// What a community profile has saved for each cosmetic, as a choice plus the value the form shows for it
// (the global one while it follows the global profile, nothing for "Don't show").
export function readCommunityCosmetics(
	member: MemberCosmeticSource | null | undefined,
	memberProfile: {theme_colors?: ReadonlyArray<number> | null; profile_frame?: string | null} | null | undefined,
	global: CommunityCosmeticValues,
): {modes: CommunityCosmeticModes; values: CommunityCosmeticValues} {
	const flags = member?.profileFlags ?? 0;
	const saved: CommunityCosmeticValues = {
		name_style: member?.nameStyle ?? null,
		avatar_frame: member?.avatarFrame ?? null,
		nameplate: member?.nameplate ?? null,
		theme_colors: memberProfile?.theme_colors ?? member?.themeColors ?? null,
		profile_frame: memberProfile?.profile_frame ?? member?.profileFrame ?? null,
	};
	const modes = {...INHERIT_ALL_COMMUNITY_COSMETICS};
	const values = {...global};
	for (const key of COMMUNITY_COSMETIC_KEYS) {
		if ((flags & UNSET_FLAGS[key]) !== 0) {
			modes[key] = 'unset';
			setValue(values, key, null);
		} else if (saved[key] != null) {
			modes[key] = 'custom';
			setValue(values, key, saved[key]);
		}
	}
	return {modes, values};
}

// The value the form should hold after switching a cosmetic to a new choice.
export function valueForCommunityMode<K extends CommunityCosmeticKey>(
	mode: CommunityCosmeticMode,
	current: CommunityCosmeticValues[K],
	globalValue: CommunityCosmeticValues[K],
): CommunityCosmeticValues[K] | null {
	if (mode === 'unset') return null;
	if (mode === 'inherit') return globalValue;
	// Picking for this community starts from what was showing, so the picker opens on something familiar.
	return current ?? globalValue;
}

// The request fields and the "Don't show" profile flags for saving a community profile's cosmetics.
export function buildCommunityCosmeticPatch(
	modes: CommunityCosmeticModes,
	values: CommunityCosmeticValues,
): {fields: CommunityCosmeticValues; unsetFlags: number} {
	const fields: CommunityCosmeticValues = {
		name_style: null,
		avatar_frame: null,
		nameplate: null,
		theme_colors: null,
		profile_frame: null,
	};
	let unsetFlags = 0;
	for (const key of COMMUNITY_COSMETIC_KEYS) {
		if (modes[key] === 'unset') unsetFlags |= UNSET_FLAGS[key];
		else if (modes[key] === 'custom') setValue(fields, key, values[key]);
	}
	return {fields, unsetFlags};
}

function setValue<K extends CommunityCosmeticKey>(
	target: CommunityCosmeticValues,
	key: K,
	value: CommunityCosmeticValues[K] | null,
): void {
	target[key] = value as CommunityCosmeticValues[K];
}
