// SPDX-License-Identifier: AGPL-3.0-or-later

import {Logger} from '@app/api/Logger';
import type {User} from '@app/api/models/User';
import {getUserSearchService} from '@app/api/SearchFactory';
import {isDeletionComplete} from '@app/api/user/UserHelpers';

export class UserSearchRepository {
	async indexUser(user: User): Promise<void> {
		const userSearchService = getUserSearchService();
		if (userSearchService && isDeletionComplete(user)) {
			await this.removeDeletedUser(user);
			return;
		}
		if (userSearchService) {
			await userSearchService.indexUser(user).catch((error) => {
				Logger.error({userId: user.id, error}, 'Failed to index user in search');
			});
		}
	}

	async updateUser(user: User): Promise<void> {
		const userSearchService = getUserSearchService();
		if (userSearchService && isDeletionComplete(user)) {
			await this.removeDeletedUser(user);
			return;
		}
		if (userSearchService) {
			await userSearchService.updateUser(user).catch((error) => {
				Logger.error({userId: user.id, error}, 'Failed to update user in search');
			});
		}
	}

	// A completed deletion leaves no searchable document behind: the old name, email and other
	// fields stay out of search (upstream b01ce726c).
	private async removeDeletedUser(user: User): Promise<void> {
		await getUserSearchService()
			?.deleteUser(user.id)
			.catch((error) => {
				Logger.error({userId: user.id, error}, 'Failed to remove deleted user from search');
			});
	}
}
