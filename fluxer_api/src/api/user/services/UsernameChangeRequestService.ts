// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UsernameChangeRequestRow} from '@app/api/database/types/UserTypes';
import {profileSubstringBlocklistCache} from '@app/api/middleware/ProfileSubstringBlocklistCache';
import type {User} from '@app/api/models/User';
import {isProfileSubstringExempt} from '@app/api/user/UserHelpers';
import {UsernameChangeRequestRepository} from '@app/api/user/UsernameChangeRequestRepository';
import {type IUsernameRegistry, normalizeUsername} from '@app/api/user/UsernameRegistry';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {ContentBlockedError} from '@fluxer/errors/src/domains/content/ContentBlockedError';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';

interface UsernameChangeRequestServiceDeps {
	usernameRegistry: IUsernameRegistry;
	requestRepository?: UsernameChangeRequestRepository;
}

function isCaseOnlyChange(user: User, requestedUsername: string): boolean {
	return normalizeUsername(user.username) === normalizeUsername(requestedUsername);
}

// Users do not rename themselves: they ask for a name, it is held for them, and an admin
// approves or rejects the request. One request is open per user; a new one replaces it.
export class UsernameChangeRequestService {
	private readonly requestRepository: UsernameChangeRequestRepository;

	constructor(private readonly deps: UsernameChangeRequestServiceDeps) {
		this.requestRepository = deps.requestRepository ?? new UsernameChangeRequestRepository();
	}

	async getLatest(user: User): Promise<UsernameChangeRequestRow | null> {
		return this.requestRepository.get(user.id);
	}

	async submit(user: User, requestedUsername: string): Promise<UsernameChangeRequestRow> {
		if (requestedUsername === user.username) {
			throw InputValidationError.fromCode('username', ValidationErrorCodes.USERNAME_ALREADY_TAKEN);
		}
		if (
			!isProfileSubstringExempt(user) &&
			profileSubstringBlocklistCache.containsBannedSubstring('username', requestedUsername)
		) {
			throw new ContentBlockedError();
		}
		await this.cancelPending(user);
		// A case-only change keeps the name the account already owns, so nothing is held.
		if (!isCaseOnlyChange(user, requestedUsername)) {
			const held = await this.deps.usernameRegistry.hold(requestedUsername, user.id);
			if (!held) {
				throw InputValidationError.fromCode('username', ValidationErrorCodes.USERNAME_ALREADY_TAKEN);
			}
		}
		return this.requestRepository.createPending(user.id, requestedUsername);
	}

	async cancelPending(user: User): Promise<void> {
		const request = await this.requestRepository.get(user.id);
		if (request?.status !== 'pending') {
			return;
		}
		if (!isCaseOnlyChange(user, request.requested_username)) {
			await this.deps.usernameRegistry.releaseHold(request.requested_username, user.id);
		}
		await this.requestRepository.close(request, 'cancelled', null);
	}
}
