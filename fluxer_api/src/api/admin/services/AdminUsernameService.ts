// SPDX-License-Identifier: AGPL-3.0-or-later

import type {AdminAuditService} from '@app/api/admin/services/AdminAuditService';
import type {UserID} from '@app/api/BrandedTypes';
import type {IUsernameRegistry} from '@app/api/user/UsernameRegistry';
import type {
	AdminLockedUsernamesResponse,
	AdminReleaseUsernameResponse,
} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';

interface AdminUsernameServiceDeps {
	usernameRegistry: IUsernameRegistry;
	auditService: AdminAuditService;
}

// Username administration: the names deleted accounts left locked, which only an admin can
// make available again.
export class AdminUsernameService {
	constructor(private readonly deps: AdminUsernameServiceDeps) {}

	async listLockedUsernames(): Promise<AdminLockedUsernamesResponse> {
		const rows = await this.deps.usernameRegistry.listByState('locked');
		return {
			usernames: rows.map((row) => ({
				username: row.username_lower,
				user_id: row.user_id.toString(),
				locked_at: row.updated_at.toISOString(),
			})),
		};
	}

	async releaseLockedUsername(
		username: string,
		adminUserId: UserID,
		auditLogReason: string | null,
	): Promise<AdminReleaseUsernameResponse> {
		const entry = await this.deps.usernameRegistry.get(username);
		if (entry?.state !== 'locked') {
			return {released: false};
		}
		const released = await this.deps.usernameRegistry.releaseLocked(username);
		if (released) {
			await this.deps.auditService.createAuditLog({
				adminUserId,
				targetType: 'user',
				targetId: BigInt(entry.user_id),
				action: 'release_locked_username',
				auditLogReason,
				metadata: new Map([['username', entry.username_lower]]),
			});
		}
		return {released};
	}
}
