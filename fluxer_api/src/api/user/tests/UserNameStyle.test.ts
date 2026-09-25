// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {fetchUser, fetchUserMe} from '@app/api/user/tests/UserTestUtils';
import type {NameStyle} from '@fluxer/schema/src/domains/user/NameStyleSchemas';
import type {UserPrivateResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

const GRADIENT_STYLE: NameStyle = {
	font: 'bangers',
	effect: 'gradient',
	primary_color: 0xff0000,
	secondary_color: 0x0000ff,
};

async function setNameStyle(harness: ApiTestHarness, account: TestAccount, nameStyle: NameStyle | null) {
	return createBuilder<UserPrivateResponse>(harness, account.token)
		.patch('/users/@me')
		.body({name_style: nameStyle})
		.expect(HTTP_STATUS.OK)
		.execute();
}

describe('Display name styles', () => {
	let harness: ApiTestHarness;
	let account: TestAccount;
	let viewer: TestAccount;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	beforeEach(async () => {
		await harness.reset();
		account = await createTestAccount(harness);
		viewer = await createTestAccount(harness);
	});

	test('a new account has no name style', async () => {
		const {json} = await fetchUserMe(harness, account.token);
		expect(json.name_style).toBeUndefined();
	});

	test('a saved style is returned to the owner and to other users', async () => {
		const updated = await setNameStyle(harness, account, GRADIENT_STYLE);
		expect(updated.name_style).toEqual(GRADIENT_STYLE);

		const {json: me} = await fetchUserMe(harness, account.token);
		expect(me.name_style).toEqual(GRADIENT_STYLE);

		const {json: seen} = await fetchUser(harness, account.userId, viewer.token);
		expect(seen.name_style).toEqual(GRADIENT_STYLE);
	});

	test('null and an all-default style both reset to the default', async () => {
		await setNameStyle(harness, account, GRADIENT_STYLE);
		const cleared = await setNameStyle(harness, account, null);
		expect(cleared.name_style).toBeUndefined();

		await setNameStyle(harness, account, GRADIENT_STYLE);
		const defaults = await setNameStyle(harness, account, {
			font: null,
			effect: 'solid',
			primary_color: null,
			secondary_color: null,
		});
		expect(defaults.name_style).toBeUndefined();
	});

	test('other profile updates keep the style', async () => {
		await setNameStyle(harness, account, GRADIENT_STYLE);
		const updated = await createBuilder<UserPrivateResponse>(harness, account.token)
			.patch('/users/@me')
			.body({global_name: 'Styled'})
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(updated.name_style).toEqual(GRADIENT_STYLE);
	});

	test.each([
		['an unknown font', {...GRADIENT_STYLE, font: 'comic-sans'}],
		['an unknown effect', {...GRADIENT_STYLE, effect: 'sparkle'}],
		['a color above 0xFFFFFF', {...GRADIENT_STYLE, primary_color: 0x1000000}],
		['a negative color', {...GRADIENT_STYLE, secondary_color: -1}],
	])('rejects %s', async (_label, nameStyle) => {
		await createBuilder(harness, account.token)
			.patch('/users/@me')
			.body({name_style: nameStyle})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});
});
