// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	BOT_USERNAME_BASE_MAX_LENGTH,
	BOT_USERNAME_SUFFIX,
	USERNAME_MAX_LENGTH,
} from '@fluxer/constants/src/UserConstants';

function counterFor(attempt: number): string {
	return attempt <= 1 ? '' : String(attempt);
}

/**
 * The attempt-th name to try when a name is generated for someone: `base`, then `base2`,
 * `base3`, ... The base is shortened so the counter still fits the username limit.
 */
export function usernameCandidate(base: string, attempt: number): string {
	const counter = counterFor(attempt);
	return `${base.slice(0, USERNAME_MAX_LENGTH - counter.length)}${counter}`;
}

/** The attempt-th name to try for a bot: `base-BOT`, then `base2-BOT`, `base3-BOT`, ... */
export function botUsernameCandidate(base: string, attempt: number): string {
	const counter = counterFor(attempt);
	return `${base.slice(0, BOT_USERNAME_BASE_MAX_LENGTH - counter.length)}${counter}${BOT_USERNAME_SUFFIX}`;
}
