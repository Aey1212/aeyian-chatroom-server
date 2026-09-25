// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, setUserACLs, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS, TEST_CREDENTIALS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {fetchUserMe} from '@app/api/user/tests/UserTestUtils';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

interface ChangeLogResponse {
	entries: Array<{field: string; old_value: string | null; new_value: string | null}>;
}

// Usernames change only through an admin: directly, or by approving a rename request.
async function renameByAdmin(
	harness: ApiTestHarness,
	account: TestAccount,
	newUsername: string,
): Promise<{username: string}> {
	const admin = await setUserACLs(harness, await createTestAccount(harness), [
		AdminACLs.AUTHENTICATE,
		AdminACLs.USER_UPDATE_USERNAME,
	]);
	const {user} = await createBuilder<{user: {username: string}}>(harness, admin.token)
		.patch(`/admin/users/${account.userId}/username`)
		.body({username: newUsername})
		.execute();
	return user;
}

describe('UserContactChangeLogService', () => {
	let harness: ApiTestHarness;
	beforeAll(async () => {
		harness = await createApiTestHarness();
	});
	beforeEach(async () => {
		await harness.reset();
	});
	afterAll(async () => {
		await harness?.shutdown();
	});
	describe('email change operations', () => {
		test('direct email change is rejected - requires email_token flow', async () => {
			const account = await createTestAccount(harness, {
				email: 'original@example.com',
			});
			const {json} = await createBuilder(harness, account.token)
				.patch('/users/@me')
				.body({email: 'updated@example.com', password: TEST_CREDENTIALS.STRONG_PASSWORD})
				.expect(HTTP_STATUS.BAD_REQUEST, 'INVALID_FORM_BODY')
				.executeWithResponse();
			const body = json as {
				errors?: Array<{
					code: string;
				}>;
			};
			expect(body.errors?.[0]?.code).toBe('EMAIL_MUST_BE_CHANGED_VIA_TOKEN');
		});
		test('email change without password is rejected', async () => {
			const account = await createTestAccount(harness);
			const json = await createBuilder(harness, account.token)
				.patch('/users/@me')
				.body({email: 'new@example.com'})
				.expect(HTTP_STATUS.BAD_REQUEST, 'INVALID_FORM_BODY')
				.execute();
			const body = json as {
				errors?: Array<{
					code: string;
				}>;
			};
			expect(body.errors?.[0]?.code).toBe('EMAIL_MUST_BE_CHANGED_VIA_TOKEN');
		});
	});
	describe('username change operations', () => {
		test('an admin rename updates the profile and records the change', async () => {
			const account = await createTestAccount(harness, {
				username: 'originaluser',
			});
			const updatedUser = await renameByAdmin(harness, account, 'newusername');
			expect(updatedUser.username).toBe('newusername');
			const admin = await setUserACLs(harness, await createTestAccount(harness), [AdminACLs.WILDCARD]);
			const log = await createBuilder<ChangeLogResponse>(harness, admin.token)
				.get(`/admin/users/${account.userId}/change-log?limit=50`)
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(log.entries).toContainEqual(
				expect.objectContaining({field: 'username', old_value: 'originaluser', new_value: 'newusername'}),
			);
		});
		test('a profile update does not change the username', async () => {
			const account = await createTestAccount(harness, {username: 'keptname'});
			await createBuilder(harness, account.token)
				.patch('/users/@me')
				.body({username: 'newusername', password: TEST_CREDENTIALS.STRONG_PASSWORD})
				.expect(HTTP_STATUS.OK)
				.execute();
			const {json: me} = await fetchUserMe(harness, account.token);
			expect(me.username).toBe('keptname');
		});
	});
	describe('no change scenarios', () => {
		test('updating to same username value succeeds', async () => {
			const originalUsername = `sameuser_${Date.now()}`;
			const account = await createTestAccount(harness, {
				username: originalUsername,
			});
			const updatedUser = await renameByAdmin(harness, account, originalUsername);
			expect(updatedUser.username).toBe(originalUsername);
		});
	});
	describe('sequential changes', () => {
		test('multiple sequential username changes', async () => {
			const account = await createTestAccount(harness, {
				username: 'seqname1',
			});
			const result1 = await renameByAdmin(harness, account, 'seqname2');
			expect(result1.username).toBe('seqname2');
			const result2 = await renameByAdmin(harness, account, 'seqname3');
			expect(result2.username).toBe('seqname3');
			const {json: finalState} = await fetchUserMe(harness, account.token);
			expect(finalState.username).toBe('seqname3');
		});
	});
	describe('validation errors', () => {
		test('invalid email format is rejected with format error', async () => {
			const account = await createTestAccount(harness);
			const {json} = await createBuilder(harness, account.token)
				.patch('/users/@me')
				.body({email: 'invalid-email', password: TEST_CREDENTIALS.STRONG_PASSWORD})
				.expect(HTTP_STATUS.BAD_REQUEST, 'INVALID_FORM_BODY')
				.executeWithResponse();
			const body = json as {
				errors?: Array<{
					code: string;
				}>;
			};
			expect(body.errors?.[0]?.code).toBe('INVALID_EMAIL_FORMAT');
		});
		test('empty username rejected', async () => {
			const account = await createTestAccount(harness);
			await createBuilder(harness, account.token)
				.put('/users/@me/username-change-request')
				.body({username: ''})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});
	});
});
