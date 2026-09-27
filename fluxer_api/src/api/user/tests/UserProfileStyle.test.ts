// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {fetchUserMe, fetchUserProfile} from '@app/api/user/tests/UserTestUtils';
import type {UserPrivateResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

async function patchMe(harness: ApiTestHarness, account: TestAccount, body: Record<string, unknown>) {
	return createBuilder<UserPrivateResponse>(harness, account.token)
		.patch('/users/@me')
		.body(body)
		.expect(HTTP_STATUS.OK)
		.execute();
}

describe('Profile theme and frame', () => {
	let harness: ApiTestHarness;
	let account: TestAccount;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	beforeEach(async () => {
		await harness.reset();
		account = await createTestAccount(harness);
	});

	test('a new account has no theme and no frame', async () => {
		const {json} = await fetchUserMe(harness, account.token);
		expect(json.theme_colors).toBeNull();
		expect(json.profile_frame).toBeNull();
	});

	test('a saved theme and frame show on the user and in the profile', async () => {
		const updated = await patchMe(harness, account, {theme_colors: [0x5865f2, 0xeb459e], profile_frame: 'aurora'});
		expect(updated.theme_colors).toEqual([0x5865f2, 0xeb459e]);
		expect(updated.profile_frame).toBe('aurora');

		const {json: profile} = await fetchUserProfile(harness, account.userId, account.token);
		expect(profile.user_profile.theme_colors).toEqual([0x5865f2, 0xeb459e]);
		expect(profile.user_profile.profile_frame).toBe('aurora');
	});

	test('null clears them and other updates keep them', async () => {
		await patchMe(harness, account, {theme_colors: [0x111111, 0x222222], profile_frame: 'gold'});
		const renamed = await patchMe(harness, account, {global_name: 'Themed'});
		expect(renamed.theme_colors).toEqual([0x111111, 0x222222]);
		expect(renamed.profile_frame).toBe('gold');

		const cleared = await patchMe(harness, account, {theme_colors: null, profile_frame: null});
		expect(cleared.theme_colors).toBeNull();
		expect(cleared.profile_frame).toBeNull();
	});

	test.each([
		['one theme colour', {theme_colors: [0x111111]}],
		['three theme colours', {theme_colors: [1, 2, 3]}],
		['a theme colour above 0xFFFFFF', {theme_colors: [0x1000000, 0]}],
		['an unknown frame', {profile_frame: 'lava-lamp'}],
	])('rejects %s', async (_label, body) => {
		await createBuilder(harness, account.token)
			.patch('/users/@me')
			.body(body)
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});
});
