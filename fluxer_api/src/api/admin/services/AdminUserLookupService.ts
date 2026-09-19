// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ApiContext} from '@app/api/ApiContext';
import {mapUserToAdminResponse} from '@app/api/admin/models/UserTypes';
import {createUserID} from '@app/api/BrandedTypes';
import {isSyntheticUserId} from '@app/api/constants/Core';
import {Logger} from '@app/api/Logger';
import type {LookupUserRequest} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';

interface AdminUserLookupServiceDeps {
	apiContext: ApiContext;
}

export class AdminUserLookupService {
	constructor(private readonly deps: AdminUserLookupServiceDeps) {}

	async lookupUser(data: LookupUserRequest, acls: ReadonlySet<string>) {
		const {users: userRepository, cache: cacheService} = this.deps.apiContext.services;
		if ('user_ids' in data) {
			const userIds = data.user_ids.map((id) => createUserID(id));
			const users = await userRepository.listUsers(userIds);
			return {
				users: await Promise.all(users.map((user) => mapUserToAdminResponse(user, cacheService, acls))),
			};
		}
		let user = null;
		const query = data.query.trim();
		// Usernames may be all digits, or look like a Stripe subscription ID, so a query that is
		// not an email is also tried as a username.
		if (/^\d+$/.test(query)) {
			try {
				const userId = createUserID(BigInt(query));
				user = isSyntheticUserId(userId) ? null : await userRepository.findUnique(userId);
			} catch (error) {
				Logger.debug({query, error}, 'Failed to lookup user by numeric ID, invalid ID format');
				user = null;
			}
			user ??= await userRepository.findByUsername(query);
		} else if (query.includes('@')) {
			user = await userRepository.findByEmail(query);
		} else {
			user = (await userRepository.findByUsername(query)) ?? (await userRepository.findByStripeSubscriptionId(query));
		}
		return {
			users: user ? [await mapUserToAdminResponse(user, cacheService, acls)] : [],
		};
	}
}
