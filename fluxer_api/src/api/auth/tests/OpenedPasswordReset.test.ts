// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, loginUser, setUserACLs} from '@app/api/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

interface ValidationErrorResponse {
	code: string;
	errors?: Array<{path: string; code: string}>;
}

const NEW_PASSWORD = 'a-brand-new-password-42';

describe('password reset opened by an admin', () => {
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

	async function attemptReset(login: string) {
		return createBuilderWithoutAuth<ValidationErrorResponse>(harness)
			.post('/auth/password-reset')
			.body({login, password: NEW_PASSWORD});
	}

	test('is refused while no reset is open', async () => {
		const account = await createTestAccount(harness);
		const json = await (await attemptReset(account.username!))
			.expect(HTTP_STATUS.BAD_REQUEST, 'INVALID_FORM_BODY')
			.execute();
		expect(json.errors?.find((error) => error.path === 'login')?.code).toBe('INVALID_OR_EXPIRED_RESET_TOKEN');
	});

	test('lets the owner choose a new password once, after an admin opened it', async () => {
		const account = await createTestAccount(harness);
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, [AdminACLs.AUTHENTICATE, AdminACLs.USER_UPDATE_EMAIL]);

		const opened = await createBuilder<{open: boolean}>(harness, admin.token)
			.put(`/admin/users/${account.userId}/password-reset-mode`)
			.body({open: true})
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(opened.open).toBe(true);

		const reset = await (await attemptReset(account.username!)).expect(HTTP_STATUS.OK).execute();
		expect('token' in reset).toBe(true);

		const login = await loginUser(harness, {login: account.username!, password: NEW_PASSWORD});
		expect('token' in login && login.token).toBeTruthy();

		await (await attemptReset(account.username!)).expect(HTTP_STATUS.BAD_REQUEST, 'INVALID_FORM_BODY').execute();
	});
});
