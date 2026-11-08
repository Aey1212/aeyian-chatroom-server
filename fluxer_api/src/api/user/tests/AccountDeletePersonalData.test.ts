// SPDX-License-Identifier: AGPL-3.0-or-later

// Upstream Fluxer b01ce726c ("clear personal data from deleted accounts"), adapted: this fork has no
// immediate admin deletion, so the account goes through the normal self-deletion path.

import {createTestAccount, setUserACLs} from '@app/api/auth/tests/AuthTestUtils';
import {createUserID} from '@app/api/BrandedTypes';
import {createApiContext} from '@app/api/CreateApiContext';
import {getUserSearchService} from '@app/api/SearchFactory';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {
	deleteAccount,
	setPendingDeletionAt,
	triggerDeletionWorker,
	waitForDeletionCompletion,
} from '@app/api/user/tests/UserTestUtils';
import {isDeletionComplete} from '@app/api/user/UserHelpers';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {DeletionReasons} from '@fluxer/constants/src/Core';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

describe('account deletion clears personal data', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness({search: 'enabled'});
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	async function searchHits(query: string): Promise<Array<string>> {
		const result = await getUserSearchService()!.searchUsers(query, {}, {limit: 100});
		return result.hits.map((hit) => hit.id);
	}

	test('a completed deletion leaves no personal field, no search entry, no second deletion and no cancel', async () => {
		const account = await createTestAccount(harness);
		const users = createApiContext().services.users;
		const userId = createUserID(BigInt(account.userId));
		const before = await users.findUniqueAssert(userId);
		await users.patchUpsert(
			userId,
			{
				last_active_ip: '203.0.113.44',
				last_active_at: new Date(),
				locale: 'tr',
				terms_agreed_at: new Date(),
				privacy_agreed_at: new Date(),
				theme_colors: [0x5865f2, 0xeb459e],
				nameplate: 'gold',
			},
			before.toRow(),
		);
		expect(await searchHits(account.email)).toContain(account.userId);

		await deleteAccount(harness, account.token, account.password);
		const past = new Date();
		past.setMinutes(past.getMinutes() - 1);
		await setPendingDeletionAt(harness, account.userId, past);
		await triggerDeletionWorker(harness);
		await waitForDeletionCompletion(harness, account.userId);

		const row = (await users.findUniqueAssert(userId)).toRow();
		expect(row).toMatchObject({
			username: 'DeletedUser',
			email: null,
			password_hash: null,
			last_active_ip: null,
			last_active_at: null,
			locale: null,
			terms_agreed_at: null,
			privacy_agreed_at: null,
			theme_colors: null,
			nameplate: null,
		});
		expect(await searchHits(account.email)).not.toContain(account.userId);
		expect(await searchHits('')).not.toContain(account.userId);

		const admin = await setUserACLs(harness, await createTestAccount(harness), [
			AdminACLs.AUTHENTICATE,
			AdminACLs.USER_DELETE,
		]);
		await createBuilder(harness, admin.token)
			.put(`/admin/users/${account.userId}/deletion`)
			.body({reason_code: DeletionReasons.USER_REQUESTED, days_until_deletion: 1})
			.expect(HTTP_STATUS.CONFLICT, APIErrorCodes.CONFLICT)
			.execute();
		await createBuilder(harness, admin.token)
			.delete(`/admin/users/${account.userId}/deletion`)
			.expect(HTTP_STATUS.CONFLICT, APIErrorCodes.CONFLICT)
			.execute();
		expect(isDeletionComplete(await users.findUniqueAssert(userId))).toBe(true);
		expect(await searchHits('')).not.toContain(account.userId);
	});
});
