// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, setUserACLs, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {getPngDataUrl} from '@app/api/emoji/tests/EmojiTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import type {AdminCosmeticResponse, CosmeticListResponse} from '@fluxer/schema/src/domains/cosmetics/CosmeticSchemas';
import type {UserPrivateResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

describe('Cosmetics', () => {
	let harness: ApiTestHarness;
	let admin: TestAccount;
	let user: TestAccount;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	beforeEach(async () => {
		await harness.reset();
		admin = await setUserACLs(harness, await createTestAccount(harness), [
			AdminACLs.AUTHENTICATE,
			AdminACLs.COSMETICS_MANAGE,
		]);
		user = await createTestAccount(harness);
	});

	async function upload(kind: 'avatar_frame' | 'nameplate', name: string): Promise<AdminCosmeticResponse> {
		return createBuilder<AdminCosmeticResponse>(harness, admin.token)
			.post('/admin/cosmetics')
			.body({kind, name, image: getPngDataUrl()})
			.expect(HTTP_STATUS.OK)
			.execute();
	}

	function patchMe(body: Record<string, unknown>, status: number = HTTP_STATUS.OK) {
		return createBuilder<UserPrivateResponse>(harness, user.token)
			.patch('/users/@me')
			.body(body)
			.expect(status)
			.execute();
	}

	test('uploaded cosmetics are listed for every account, newest first, and deleting removes them', async () => {
		const frame = await upload('avatar_frame', 'Ring');
		const plate = await upload('nameplate', 'Stars');
		expect(frame.kind).toBe('avatar_frame');
		expect(frame.creator_id).toBe(admin.userId);

		const listed = await createBuilder<CosmeticListResponse>(harness, user.token)
			.get('/cosmetics')
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(listed.cosmetics.map((cosmetic) => cosmetic.id)).toEqual([plate.id, frame.id]);

		await createBuilder(harness, admin.token).delete(`/admin/cosmetics/${frame.id}`).expect(HTTP_STATUS.OK).execute();
		const after = await createBuilder<CosmeticListResponse>(harness, user.token)
			.get('/cosmetics')
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(after.cosmetics.map((cosmetic) => cosmetic.id)).toEqual([plate.id]);
	});

	test('a user can pick built-in and uploaded cosmetics and clear them', async () => {
		const frame = await upload('avatar_frame', 'Ring');
		const builtin = await patchMe({avatar_frame: 'halo', nameplate: 'aurora'});
		expect(builtin.avatar_frame).toBe('halo');
		expect(builtin.nameplate).toBe('aurora');

		const uploaded = await patchMe({avatar_frame: frame.id});
		expect(uploaded.avatar_frame).toBe(frame.id);

		const cleared = await patchMe({avatar_frame: null, nameplate: null});
		expect(cleared.avatar_frame).toBeUndefined();
		expect(cleared.nameplate).toBeUndefined();
	});

	test('a cosmetic of the wrong kind or an unknown id is refused', async () => {
		const frame = await upload('avatar_frame', 'Ring');
		await patchMe({nameplate: frame.id}, HTTP_STATUS.BAD_REQUEST);
		await patchMe({avatar_frame: 'aurora'}, HTTP_STATUS.BAD_REQUEST);
		await patchMe({avatar_frame: 'lava-lamp'}, HTTP_STATUS.BAD_REQUEST);
		await patchMe({avatar_frame: '1234567890123456789'}, HTTP_STATUS.BAD_REQUEST);
	});

	test('only admins with the cosmetics permission can manage cosmetics', async () => {
		await createBuilder(harness, user.token).get('/admin/cosmetics').expect(HTTP_STATUS.FORBIDDEN).execute();
		await createBuilder(harness, user.token)
			.post('/admin/cosmetics')
			.body({kind: 'avatar_frame', name: 'Nope', image: getPngDataUrl()})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});
});
