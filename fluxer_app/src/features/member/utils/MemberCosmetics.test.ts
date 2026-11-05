// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	communityProfileStyleSource,
	effectiveAvatarFrame,
	effectiveNameplate,
	effectiveNameStyle,
	effectiveProfileFrame,
	effectiveThemeColors,
} from '@app/features/member/utils/MemberCosmetics';
import {GuildMemberProfileFlags} from '@fluxer/constants/src/GuildConstants';
import type {NameStyle} from '@fluxer/schema/src/domains/user/NameStyleSchemas';
import {describe, expect, it} from 'vitest';

const GLOBAL_STYLE: NameStyle = {
	font: 'bangers',
	effect: 'solid',
	primary_color: 0xff0000,
	secondary_color: null,
	gradient_direction: 'horizontal',
	intensity: 100,
};
const COMMUNITY_STYLE: NameStyle = {...GLOBAL_STYLE, primary_color: 0x00ff00};

describe('community versions of the profile cosmetics', () => {
	it('outside a community the global one shows', () => {
		expect(effectiveNameStyle(GLOBAL_STYLE, null)).toEqual(GLOBAL_STYLE);
		expect(effectiveAvatarFrame('halo', undefined)).toBe('halo');
	});

	it('a community member with nothing set shows the global one', () => {
		const member = {profileFlags: 0};
		expect(effectiveNameStyle(GLOBAL_STYLE, member)).toEqual(GLOBAL_STYLE);
		expect(effectiveNameplate('galaxy', member)).toBe('galaxy');
		expect(effectiveThemeColors([1, 2], member)).toEqual([1, 2]);
		expect(effectiveProfileFrame('gold', member)).toBe('gold');
	});

	it('a community version wins over the global one', () => {
		const member = {
			profileFlags: 0,
			nameStyle: COMMUNITY_STYLE,
			avatarFrame: 'frost',
			nameplate: 'mint',
			themeColors: [3, 4] as const,
			profileFrame: 'pixel',
		};
		expect(effectiveNameStyle(GLOBAL_STYLE, member)).toEqual(COMMUNITY_STYLE);
		expect(effectiveAvatarFrame('halo', member)).toBe('frost');
		expect(effectiveNameplate('galaxy', member)).toBe('mint');
		expect(effectiveThemeColors([1, 2], member)).toEqual([3, 4]);
		expect(effectiveProfileFrame('gold', member)).toBe('pixel');
	});

	it("Don't show hides it in that community, even with a global one", () => {
		const member = {
			profileFlags:
				GuildMemberProfileFlags.NAME_STYLE_UNSET |
				GuildMemberProfileFlags.AVATAR_FRAME_UNSET |
				GuildMemberProfileFlags.NAMEPLATE_UNSET |
				GuildMemberProfileFlags.THEME_COLORS_UNSET |
				GuildMemberProfileFlags.PROFILE_FRAME_UNSET,
			nameplate: 'mint',
		};
		expect(effectiveNameStyle(GLOBAL_STYLE, member)).toBeNull();
		expect(effectiveAvatarFrame('halo', member)).toBeNull();
		expect(effectiveNameplate('galaxy', member)).toBeNull();
		expect(effectiveThemeColors([1, 2], member)).toBeNull();
		expect(effectiveProfileFrame('gold', member)).toBeNull();
	});

	it("each Don't show flag only hides its own cosmetic", () => {
		const member = {profileFlags: GuildMemberProfileFlags.NAMEPLATE_UNSET};
		expect(effectiveNameplate('galaxy', member)).toBeNull();
		expect(effectiveAvatarFrame('halo', member)).toBe('halo');
	});

	it('a community profile takes its theme and frame from the live member, not an older cached copy', () => {
		const cached = {theme_colors: [3, 4], profile_frame: 'aurora'};
		const changed = communityProfileStyleSource({profileFlags: 0, themeColors: [5, 6]}, cached);
		expect(effectiveThemeColors([1, 2], changed)).toEqual([5, 6]);
		const backToGlobal = communityProfileStyleSource({profileFlags: 0}, cached);
		expect(effectiveThemeColors([1, 2], backToGlobal)).toEqual([1, 2]);
		expect(effectiveProfileFrame('gold', backToGlobal)).toBe('gold');
	});

	it('a community profile uses the fetched copy when the member is not known', () => {
		const source = communityProfileStyleSource(null, {theme_colors: [3, 4], profile_frame: 'aurora'});
		expect(effectiveThemeColors([1, 2], source)).toEqual([3, 4]);
		expect(effectiveProfileFrame('gold', source)).toBe('aurora');
	});
});
