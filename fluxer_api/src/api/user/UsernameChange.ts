// SPDX-License-Identifier: AGPL-3.0-or-later

import type {User} from '@app/api/models/User';
import type {IUserRepository} from '@app/api/user/IUserRepository';
import {type IUsernameRegistry, normalizeUsername} from '@app/api/user/UsernameRegistry';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';

// What a rename does to the name it leaves behind: 'locked' keeps the old name reserved like a
// deleted account's, until an admin releases it; 'free' releases it immediately.
export const OLD_USERNAME_AFTER_RENAME: 'locked' | 'free' = 'locked';

interface UsernameChangeDeps {
	usernameRegistry: IUsernameRegistry;
	userRepository: IUserRepository;
}

/**
 * Moves an account to a new username and retires the old one.
 * `viaHold` is set when the new name was reserved by an approved rename request; otherwise the
 * name is claimed here. A change of letter case only is a display change and keeps the claim.
 */
export async function applyUsernameChange(
	deps: UsernameChangeDeps,
	user: User,
	newUsername: string,
	options?: {viaHold?: boolean},
): Promise<User> {
	const {usernameRegistry, userRepository} = deps;
	const sameName = normalizeUsername(newUsername) === normalizeUsername(user.username);
	if (!sameName) {
		const acquired = options?.viaHold
			? await usernameRegistry.activateHold(newUsername, user.id)
			: await usernameRegistry.claim(newUsername, user.id);
		if (!acquired) {
			throw InputValidationError.fromCode('username', ValidationErrorCodes.USERNAME_ALREADY_TAKEN);
		}
	}
	let updatedUser: User;
	try {
		updatedUser = await userRepository.patchUpsert(user.id, {username: newUsername}, user.toRow());
	} catch (error) {
		if (!sameName) {
			await usernameRegistry.release(newUsername, user.id);
		}
		throw error;
	}
	if (!sameName) {
		if (OLD_USERNAME_AFTER_RENAME === 'locked') {
			await usernameRegistry.lock(user.username, user.id);
		} else {
			await usernameRegistry.release(user.username, user.id);
		}
	}
	return updatedUser;
}
