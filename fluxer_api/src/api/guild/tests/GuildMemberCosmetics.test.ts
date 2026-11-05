// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createGuild, getMember} from '@app/api/guild/tests/GuildTestUtils';
import {ensureSessionStarted} from '@app/api/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {fetchUserMe, grantPremium} from '@app/api/user/tests/UserTestUtils';
import {GuildMemberProfileFlags} from '@fluxer/constants/src/GuildConstants';
import type {GuildMemberResponse} from '@fluxer/schema/src/domains/guild/GuildMemberSchemas';
import type {NameStyle} from '@fluxer/schema/src/domains/user/NameStyleSchemas';
import type {UserProfileFullResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

const COMMUNITY_STYLE: NameStyle = {
	font: 'bangers',
	effect: 'gradient',
	primary_color: 0xff0000,
	secondary_color: 0x0000ff,
	gradient_direction: 'vertical',
	intensity: 80,
};

const ALL_FIVE = {
	name_style: COMMUNITY_STYLE,
	avatar_frame: 'halo',
	nameplate: 'galaxy',
	theme_colors: [0x5865f2, 0xeb459e],
	profile_frame: 'aurora',
};

async function patchMyMember(
	harness: ApiTestHarness,
	account: TestAccount,
	guildId: string,
	body: Record<string, unknown>,
): Promise<GuildMemberResponse> {
	return createBuilder<GuildMemberResponse>(harness, account.token)
		.patch(`/guilds/${guildId}/members/@me`)
		.body(body)
		.expect(HTTP_STATUS.OK)
		.execute();
}

async function fetchProfileIn(
	harness: ApiTestHarness,
	account: TestAccount,
	guildId: string,
): Promise<UserProfileFullResponse> {
	return createBuilder<UserProfileFullResponse>(harness, account.token)
		.get(`/users/${account.userId}/profile?guild_id=${guildId}`)
		.expect(HTTP_STATUS.OK)
		.execute();
}

describe('Community versions of the profile cosmetics', () => {
	let harness: ApiTestHarness;
	let account: TestAccount;
	let guildId: string;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	beforeEach(async () => {
		await harness.reset();
		account = await createTestAccount(harness);
		guildId = (await createGuild(harness, account.token, 'Cosmetics community')).id;
		await ensureSessionStarted(harness, account.token);
		// The test instance is not self-hosted, so community profiles need premium (self-hosted gives them to everyone).
		await grantPremium(harness, account.userId, 2);
	});

	test('a member starts with no community versions', async () => {
		const member = await getMember(harness, account.token, guildId, account.userId);
		expect(member.name_style).toBeUndefined();
		expect(member.avatar_frame).toBeUndefined();
		expect(member.nameplate).toBeUndefined();
		expect(member.theme_colors).toBeUndefined();
		expect(member.profile_frame).toBeUndefined();

		const profile = await fetchProfileIn(harness, account, guildId);
		expect(profile.guild_member_profile?.theme_colors).toBeNull();
		expect(profile.guild_member_profile?.profile_frame).toBeNull();
	});

	test('all five saved in a community show on the member and in the community profile', async () => {
		const updated = await patchMyMember(harness, account, guildId, ALL_FIVE);
		expect(updated.name_style).toEqual(COMMUNITY_STYLE);
		expect(updated.avatar_frame).toBe('halo');
		expect(updated.nameplate).toBe('galaxy');
		expect(updated.theme_colors).toEqual([0x5865f2, 0xeb459e]);
		expect(updated.profile_frame).toBe('aurora');

		const member = await getMember(harness, account.token, guildId, account.userId);
		expect(member.name_style).toEqual(COMMUNITY_STYLE);
		expect(member.nameplate).toBe('galaxy');

		const profile = await fetchProfileIn(harness, account, guildId);
		expect(profile.guild_member_profile?.theme_colors).toEqual([0x5865f2, 0xeb459e]);
		expect(profile.guild_member_profile?.profile_frame).toBe('aurora');
		expect(profile.guild_member?.avatar_frame).toBe('halo');
	});

	test('community versions leave the global profile and other communities alone', async () => {
		const otherGuildId = (await createGuild(harness, account.token, 'Other community')).id;
		await patchMyMember(harness, account, guildId, ALL_FIVE);

		const {json: me} = await fetchUserMe(harness, account.token);
		expect(me.name_style).toBeUndefined();
		expect(me.avatar_frame).toBeUndefined();
		expect(me.nameplate).toBeUndefined();
		expect(me.theme_colors).toBeNull();
		expect(me.profile_frame).toBeNull();

		const other = await getMember(harness, account.token, otherGuildId, account.userId);
		expect(other.name_style).toBeUndefined();
		expect(other.avatar_frame).toBeUndefined();
		expect(other.nameplate).toBeUndefined();
	});

	test('null goes back to the global one, and other updates keep them', async () => {
		await patchMyMember(harness, account, guildId, ALL_FIVE);
		const renamed = await patchMyMember(harness, account, guildId, {nick: 'Styled'});
		expect(renamed.nameplate).toBe('galaxy');
		expect(renamed.profile_frame).toBe('aurora');

		const cleared = await patchMyMember(harness, account, guildId, {
			name_style: null,
			avatar_frame: null,
			nameplate: null,
			theme_colors: null,
			profile_frame: null,
		});
		expect(cleared.name_style).toBeUndefined();
		expect(cleared.avatar_frame).toBeUndefined();
		expect(cleared.nameplate).toBeUndefined();
		expect(cleared.theme_colors).toBeUndefined();
		expect(cleared.profile_frame).toBeUndefined();
	});

	test('the None flags are kept on the member', async () => {
		const none =
			GuildMemberProfileFlags.NAME_STYLE_UNSET |
			GuildMemberProfileFlags.AVATAR_FRAME_UNSET |
			GuildMemberProfileFlags.NAMEPLATE_UNSET |
			GuildMemberProfileFlags.THEME_COLORS_UNSET |
			GuildMemberProfileFlags.PROFILE_FRAME_UNSET;
		const updated = await patchMyMember(harness, account, guildId, {profile_flags: none});
		expect(updated.profile_flags).toBe(none);
		const member = await getMember(harness, account.token, guildId, account.userId);
		expect(member.profile_flags).toBe(none);
	});

	test.each([
		['an unknown avatar frame', {avatar_frame: 'lava-lamp'}],
		['a nameplate id used as an avatar frame', {avatar_frame: 'aurora'}],
		['an uploaded cosmetic that does not exist', {nameplate: '1234567890123456789'}],
		['one theme colour', {theme_colors: [0x111111]}],
		['an unknown profile frame', {profile_frame: 'lava-lamp'}],
		['an unknown name font', {name_style: {...COMMUNITY_STYLE, font: 'comic-sans'}}],
	])('rejects %s', async (_label, body) => {
		await createBuilder(harness, account.token)
			.patch(`/guilds/${guildId}/members/@me`)
			.body(body)
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('without community profiles the fields are ignored, like community avatars', async () => {
		const plain = await createTestAccount(harness);
		const plainGuildId = (await createGuild(harness, plain.token, 'Plain community')).id;
		const updated = await patchMyMember(harness, plain, plainGuildId, ALL_FIVE);
		expect(updated.name_style).toBeUndefined();
		expect(updated.nameplate).toBeUndefined();
		expect(updated.theme_colors).toBeUndefined();
	});
});
