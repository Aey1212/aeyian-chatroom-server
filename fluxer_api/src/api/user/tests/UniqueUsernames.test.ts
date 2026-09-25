// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	createTestAccount,
	createUniqueEmail,
	createUniqueUsername,
	loginUser,
	setUserACLs,
	type TestAccount,
} from '@app/api/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {
	checkUsernameAvailability,
	deleteAccount,
	fetchUserMe,
	setPendingDeletionAt,
	triggerDeletionWorker,
	waitForDeletionCompletion,
} from '@app/api/user/tests/UserTestUtils';
import {OLD_USERNAME_AFTER_RENAME} from '@app/api/user/UsernameChange';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import type {
	AdminLockedUsernamesResponse,
	AdminUsernameChangeDecisionResponse,
	AdminUsernameChangeRequestsResponse,
} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import type {UsernameChangeRequestResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

interface ValidationErrorResponse {
	code: string;
	errors?: Array<{path: string; code: string}>;
}

async function isTaken(harness: ApiTestHarness, username: string, viewer: TestAccount): Promise<boolean> {
	return (await checkUsernameAvailability(harness, username, viewer.token)).json.taken;
}

async function createUsernameAdmin(harness: ApiTestHarness): Promise<TestAccount> {
	const admin = await createTestAccount(harness);
	await setUserACLs(harness, admin, [AdminACLs.AUTHENTICATE, AdminACLs.USER_UPDATE_USERNAME]);
	return admin;
}

async function requestRename(harness: ApiTestHarness, account: TestAccount, username: string) {
	return createBuilder<UsernameChangeRequestResponse>(harness, account.token)
		.put('/users/@me/username-change-request')
		.body({username})
		.expect(HTTP_STATUS.OK)
		.execute();
}

async function decide(
	harness: ApiTestHarness,
	admin: TestAccount,
	account: TestAccount,
	decision: 'approve' | 'reject',
) {
	return createBuilder<AdminUsernameChangeDecisionResponse>(harness, admin.token)
		.post(`/admin/username-change-requests/${account.userId}/${decision}`)
		.expect(HTTP_STATUS.OK)
		.execute();
}

describe('unique usernames', () => {
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

	test('registration refuses a name that is taken, ignoring case', async () => {
		const existing = await createTestAccount(harness);
		const json = await createBuilderWithoutAuth<ValidationErrorResponse>(harness)
			.post('/auth/register')
			.body({
				email: createUniqueEmail('dupe'),
				username: existing.username!.toUpperCase(),
				password: 'a-strong-password',
				date_of_birth: '2000-01-01',
				consent: true,
			})
			.expect(HTTP_STATUS.BAD_REQUEST, 'INVALID_FORM_BODY')
			.execute();
		expect(json.errors?.find((error) => error.path === 'username')?.code).toBe('USERNAME_ALREADY_TAKEN');
	});

	test('logs in with the username, ignoring case', async () => {
		const account = await createTestAccount(harness);
		const login = await loginUser(harness, {login: account.username!.toUpperCase(), password: account.password});
		expect('token' in login && login.token).toBeTruthy();
	});

	test('a rename request holds the name until an admin approves it', async () => {
		const account = await createTestAccount(harness);
		const viewer = await createTestAccount(harness);
		const admin = await createUsernameAdmin(harness);
		const oldName = account.username!;
		const newName = createUniqueUsername('renamed');

		const submitted = await requestRename(harness, account, newName);
		expect(submitted.request?.status).toBe('pending');
		expect(await isTaken(harness, newName, viewer)).toBe(true);

		const queue = await createBuilder<AdminUsernameChangeRequestsResponse>(harness, admin.token)
			.get('/admin/username-change-requests')
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(queue.requests.map((request) => request.requested_username)).toContain(newName);

		expect((await decide(harness, admin, account, 'approve')).applied).toBe(true);
		const {json: me} = await fetchUserMe(harness, account.token);
		expect(me.username).toBe(newName);
		expect(await isTaken(harness, oldName, viewer)).toBe(OLD_USERNAME_AFTER_RENAME === 'locked');
	});

	test('a new request replaces the pending one and gives its name back', async () => {
		const account = await createTestAccount(harness);
		const viewer = await createTestAccount(harness);
		const first = createUniqueUsername('first');
		const second = createUniqueUsername('second');
		await requestRename(harness, account, first);
		await requestRename(harness, account, second);
		expect(await isTaken(harness, first, viewer)).toBe(false);
		expect(await isTaken(harness, second, viewer)).toBe(true);
	});

	test('cancelling a request gives the held name back', async () => {
		const account = await createTestAccount(harness);
		const viewer = await createTestAccount(harness);
		const wanted = createUniqueUsername('wanted');
		await requestRename(harness, account, wanted);
		await createBuilder(harness, account.token)
			.delete('/users/@me/username-change-request')
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();
		expect(await isTaken(harness, wanted, viewer)).toBe(false);
		const latest = await createBuilder<UsernameChangeRequestResponse>(harness, account.token)
			.get('/users/@me/username-change-request')
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(latest.request?.status).toBe('cancelled');
	});

	test('rejecting a request gives the held name back and keeps the username', async () => {
		const account = await createTestAccount(harness);
		const viewer = await createTestAccount(harness);
		const admin = await createUsernameAdmin(harness);
		const wanted = createUniqueUsername('rejected');
		await requestRename(harness, account, wanted);
		expect((await decide(harness, admin, account, 'reject')).applied).toBe(true);
		expect(await isTaken(harness, wanted, viewer)).toBe(false);
		const {json: me} = await fetchUserMe(harness, account.token);
		expect(me.username).toBe(account.username);
	});

	test('a case-only rename keeps the name and changes its case', async () => {
		const account = await createTestAccount(harness);
		const admin = await createUsernameAdmin(harness);
		const upper = account.username!.toUpperCase();
		await requestRename(harness, account, upper);
		expect((await decide(harness, admin, account, 'approve')).applied).toBe(true);
		const {json: me} = await fetchUserMe(harness, account.token);
		expect(me.username).toBe(upper);
	});

	test('a deleted account keeps its name locked until an admin releases it', async () => {
		const account = await createTestAccount(harness);
		const viewer = await createTestAccount(harness);
		const admin = await createUsernameAdmin(harness);
		const name = account.username!;

		await deleteAccount(harness, account.token, account.password);
		const past = new Date();
		past.setMinutes(past.getMinutes() - 1);
		await setPendingDeletionAt(harness, account.userId, past);
		await triggerDeletionWorker(harness);
		await waitForDeletionCompletion(harness, account.userId);
		expect(await isTaken(harness, name, viewer)).toBe(true);

		const locked = await createBuilder<AdminLockedUsernamesResponse>(harness, admin.token)
			.get('/admin/usernames/locked')
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(locked.usernames.map((entry) => entry.username)).toContain(name.toLowerCase());

		const released = await createBuilder<{released: boolean}>(harness, admin.token)
			.post(`/admin/usernames/locked/${encodeURIComponent(name)}/release`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(released.released).toBe(true);
		expect(await isTaken(harness, name, viewer)).toBe(false);
		await createTestAccount(harness, {username: name});
	});
});
