// SPDX-License-Identifier: AGPL-3.0-or-later

import type {AdminAuditCoverageCase} from '@app/api/admin/tests/audit_coverage/AdminAuditCoverage';
import type {TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {getPngDataUrl} from '@app/api/emoji/tests/EmojiTestUtils';
import type {ApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import type {AdminCosmeticResponse} from '@fluxer/schema/src/domains/cosmetics/CosmeticSchemas';
import {expect} from 'vitest';

async function uploadCosmetic(harness: ApiTestHarness, admin: TestAccount): Promise<AdminCosmeticResponse> {
	return createBuilder<AdminCosmeticResponse>(harness, admin.token)
		.post('/admin/cosmetics')
		.body({kind: 'avatar_frame', name: 'Ring', image: getPngDataUrl()})
		.expect(HTTP_STATUS.OK)
		.execute();
}

export const CosmeticAdminAuditCases: ReadonlyArray<AdminAuditCoverageCase> = [
	{
		method: 'GET',
		route: '/admin/cosmetics',
		async prepare({harness, admin}) {
			await uploadCosmetic(harness, admin);
			return {
				request: {path: '/admin/cosmetics'},
				expected: {action: 'list_cosmetics', targetType: 'cosmetic', targetId: '0', metadata: {entry_count: '1'}},
			};
		},
	},
	{
		method: 'POST',
		route: '/admin/cosmetics',
		async prepare() {
			return {
				request: {path: '/admin/cosmetics', body: {kind: 'nameplate', name: 'Plate', image: getPngDataUrl()}},
				expected: {
					action: 'create_cosmetic',
					targetType: 'cosmetic',
					targetId: expect.any(String),
					metadata: {kind: 'nameplate', name: 'Plate'},
				},
			};
		},
	},
	{
		method: 'DELETE',
		route: '/admin/cosmetics/:cosmetic_id',
		async prepare({harness, admin}) {
			const cosmetic = await uploadCosmetic(harness, admin);
			return {
				request: {path: `/admin/cosmetics/${cosmetic.id}`},
				expected: {
					action: 'delete_cosmetic',
					targetType: 'cosmetic',
					targetId: cosmetic.id,
					metadata: {kind: 'avatar_frame', name: 'Ring'},
				},
			};
		},
	},
];
