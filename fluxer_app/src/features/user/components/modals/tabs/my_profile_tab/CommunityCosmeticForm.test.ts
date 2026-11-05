// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	buildCommunityCosmeticPatch,
	type CommunityCosmeticValues,
	INHERIT_ALL_COMMUNITY_COSMETICS,
	readCommunityCosmetics,
	valueForCommunityMode,
} from '@app/features/user/components/modals/tabs/my_profile_tab/CommunityCosmeticForm';
import {GuildMemberProfileFlags} from '@fluxer/constants/src/GuildConstants';
import {describe, expect, it} from 'vitest';

const GLOBAL: CommunityCosmeticValues = {
	name_style: null,
	avatar_frame: 'halo',
	nameplate: 'galaxy',
	theme_colors: [1, 2],
	profile_frame: 'gold',
};

describe('community profile cosmetics form', () => {
	it('a community profile with nothing saved follows the global profile and shows its values', () => {
		const {modes, values} = readCommunityCosmetics({profileFlags: 0}, null, GLOBAL);
		expect(modes).toEqual(INHERIT_ALL_COMMUNITY_COSMETICS);
		expect(values).toEqual(GLOBAL);
	});

	it("reads saved community values and Don't show flags", () => {
		const {modes, values} = readCommunityCosmetics(
			{profileFlags: GuildMemberProfileFlags.AVATAR_FRAME_UNSET, nameplate: 'mint'},
			{theme_colors: [3, 4], profile_frame: null},
			GLOBAL,
		);
		expect(modes).toEqual({
			name_style: 'inherit',
			avatar_frame: 'unset',
			nameplate: 'custom',
			theme_colors: 'custom',
			profile_frame: 'inherit',
		});
		expect(values.avatar_frame).toBeNull();
		expect(values.nameplate).toBe('mint');
		expect(values.theme_colors).toEqual([3, 4]);
		expect(values.profile_frame).toBe('gold');
	});

	it("saves only the custom values, with flags for Don't show", () => {
		const {fields, unsetFlags} = buildCommunityCosmeticPatch(
			{
				name_style: 'inherit',
				avatar_frame: 'unset',
				nameplate: 'custom',
				theme_colors: 'custom',
				profile_frame: 'inherit',
			},
			{...GLOBAL, nameplate: 'mint', theme_colors: [3, 4]},
		);
		expect(fields).toEqual({
			name_style: null,
			avatar_frame: null,
			nameplate: 'mint',
			theme_colors: [3, 4],
			profile_frame: null,
		});
		expect(unsetFlags).toBe(GuildMemberProfileFlags.AVATAR_FRAME_UNSET);
	});

	it("saves Choose for this community with nothing chosen as Don't show, not as the global one", () => {
		const modes = {...INHERIT_ALL_COMMUNITY_COSMETICS, name_style: 'custom' as const, avatar_frame: 'custom' as const};
		const {fields, unsetFlags, savedModes} = buildCommunityCosmeticPatch(modes, {
			...GLOBAL,
			name_style: null,
			avatar_frame: null,
		});
		expect(fields.name_style).toBeNull();
		expect(fields.avatar_frame).toBeNull();
		expect(unsetFlags).toBe(GuildMemberProfileFlags.NAME_STYLE_UNSET | GuildMemberProfileFlags.AVATAR_FRAME_UNSET);
		expect(savedModes).toEqual({...INHERIT_ALL_COMMUNITY_COSMETICS, name_style: 'unset', avatar_frame: 'unset'});
		const member = {profileFlags: unsetFlags};
		expect(readCommunityCosmetics(member, null, GLOBAL).modes).toEqual(savedModes);
	});

	it('switching choices sets the value the form shows', () => {
		expect(valueForCommunityMode('inherit', 'mint', 'galaxy')).toBe('galaxy');
		expect(valueForCommunityMode('unset', 'mint', 'galaxy')).toBeNull();
		expect(valueForCommunityMode('custom', 'mint', 'galaxy')).toBe('mint');
		expect(valueForCommunityMode('custom', null, 'galaxy')).toBe('galaxy');
	});

	it('a saved profile reads back the same choices', () => {
		const modes = {...INHERIT_ALL_COMMUNITY_COSMETICS, nameplate: 'custom' as const, profile_frame: 'unset' as const};
		const {fields, unsetFlags} = buildCommunityCosmeticPatch(modes, {...GLOBAL, nameplate: 'mint'});
		const member = {profileFlags: unsetFlags, nameplate: fields.nameplate};
		expect(readCommunityCosmetics(member, {theme_colors: null, profile_frame: null}, GLOBAL).modes).toEqual(modes);
	});
});
