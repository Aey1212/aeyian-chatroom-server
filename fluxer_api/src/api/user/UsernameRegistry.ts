// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserID} from '@app/api/BrandedTypes';
import {
	deleteOneOrMany,
	executeConditional,
	fetchMany,
	fetchOne,
	upsertOne,
} from '@app/api/database/CassandraQueryExecution';
import {Db} from '@app/api/database/CassandraTypes';
import type {UsernameByStateRow, UsernameRow, UsernameState} from '@app/api/database/types/UserTypes';
import {Usernames, UsernamesByState} from '@app/api/Tables';
import {DELETED_USER_USERNAME} from '@fluxer/constants/src/UserConstants';

// Names no account can ever hold. `everyone` and `here` are also rejected by the
// username validator; DeletedUser is what every deleted account displays as.
const RESERVED_USERNAMES: ReadonlySet<string> = new Set([DELETED_USER_USERNAME.toLowerCase(), 'everyone', 'here']);

const FETCH_USERNAME_QUERY = Usernames.select({
	where: Usernames.where.eq('username_lower'),
	limit: 1,
});

const FETCH_USERNAMES_BY_STATE_QUERY = UsernamesByState.select({
	where: UsernamesByState.where.eq('state'),
});

export function normalizeUsername(username: string): string {
	return username.trim().toLowerCase();
}

export interface IUsernameRegistry {
	/** Claims a free name for an account. False when it is in use, locked, held or reserved. */
	claim(username: string, userId: UserID): Promise<boolean>;
	/** Gives up an account's active claim, for example when registration fails after the claim. */
	release(username: string, userId: UserID): Promise<void>;
	/** A deleted account's name: it stays locked until an admin releases it. */
	lock(username: string, userId: UserID): Promise<void>;
	/** Admin action: a locked name becomes free to register again. False when the name is not locked. */
	releaseLocked(username: string): Promise<boolean>;
	/** Reserves a free name for a pending rename request. */
	hold(username: string, userId: UserID): Promise<boolean>;
	/** Drops a hold when its request is rejected or cancelled. */
	releaseHold(username: string, userId: UserID): Promise<void>;
	/** An approved rename: the held name becomes the account's active name. */
	activateHold(username: string, userId: UserID): Promise<boolean>;
	/** The live account using a name, if any. */
	findActiveOwner(username: string): Promise<UserID | null>;
	/** The registry entry for a name, whatever its state. */
	get(username: string): Promise<UsernameRow | null>;
	/** Locked or held names, for the admin panel. */
	listByState(state: Exclude<UsernameState, 'active'>): Promise<Array<UsernameByStateRow>>;
}

export class UsernameRegistry implements IUsernameRegistry {
	async claim(username: string, userId: UserID): Promise<boolean> {
		const usernameLower = normalizeUsername(username);
		if (RESERVED_USERNAMES.has(usernameLower)) {
			return false;
		}
		const applied = await executeConditional(
			Usernames.insertIfNotExists({
				username_lower: usernameLower,
				user_id: userId,
				state: 'active',
				updated_at: new Date(),
			}),
		);
		if (applied) {
			return true;
		}
		// A retried claim by the same account is not a conflict.
		const existing = await this.get(usernameLower);
		return existing !== null && existing.user_id === userId && existing.state === 'active';
	}

	async release(username: string, userId: UserID): Promise<void> {
		await executeConditional(
			Usernames.conditionalDeleteByPk(
				{username_lower: normalizeUsername(username)},
				{user_id: userId, state: 'active'},
			),
		);
	}

	async lock(username: string, userId: UserID): Promise<void> {
		const usernameLower = normalizeUsername(username);
		const now = new Date();
		const applied = await executeConditional(
			Usernames.conditionalPatchByPk(
				{username_lower: usernameLower},
				{state: Db.set<UsernameState>('locked'), updated_at: Db.set(now)},
				{user_id: userId},
			),
		);
		if (!applied) {
			return;
		}
		await upsertOne(
			UsernamesByState.upsertAll({state: 'locked', username_lower: usernameLower, user_id: userId, updated_at: now}),
		);
	}

	async releaseLocked(username: string): Promise<boolean> {
		const usernameLower = normalizeUsername(username);
		const applied = await executeConditional(
			Usernames.conditionalDeleteByPk({username_lower: usernameLower}, {state: 'locked'}),
		);
		if (applied) {
			await deleteOneOrMany(UsernamesByState.deleteByPk({state: 'locked', username_lower: usernameLower}));
		}
		return applied;
	}

	async hold(username: string, userId: UserID): Promise<boolean> {
		const usernameLower = normalizeUsername(username);
		if (RESERVED_USERNAMES.has(usernameLower)) {
			return false;
		}
		const now = new Date();
		const applied = await executeConditional(
			Usernames.insertIfNotExists({username_lower: usernameLower, user_id: userId, state: 'held', updated_at: now}),
		);
		if (!applied) {
			const existing = await this.get(usernameLower);
			return existing !== null && existing.user_id === userId && existing.state === 'held';
		}
		await upsertOne(
			UsernamesByState.upsertAll({state: 'held', username_lower: usernameLower, user_id: userId, updated_at: now}),
		);
		return true;
	}

	async releaseHold(username: string, userId: UserID): Promise<void> {
		const usernameLower = normalizeUsername(username);
		const applied = await executeConditional(
			Usernames.conditionalDeleteByPk({username_lower: usernameLower}, {user_id: userId, state: 'held'}),
		);
		if (applied) {
			await deleteOneOrMany(UsernamesByState.deleteByPk({state: 'held', username_lower: usernameLower}));
		}
	}

	async activateHold(username: string, userId: UserID): Promise<boolean> {
		const usernameLower = normalizeUsername(username);
		const applied = await executeConditional(
			Usernames.conditionalPatchByPk(
				{username_lower: usernameLower},
				{state: Db.set<UsernameState>('active'), updated_at: Db.set(new Date())},
				{user_id: userId, state: 'held'},
			),
		);
		if (applied) {
			await deleteOneOrMany(UsernamesByState.deleteByPk({state: 'held', username_lower: usernameLower}));
		}
		return applied;
	}

	async findActiveOwner(username: string): Promise<UserID | null> {
		const row = await this.get(username);
		return row !== null && row.state === 'active' ? row.user_id : null;
	}

	async get(username: string): Promise<UsernameRow | null> {
		return fetchOne<UsernameRow>(FETCH_USERNAME_QUERY.bind({username_lower: normalizeUsername(username)}));
	}

	async listByState(state: Exclude<UsernameState, 'active'>): Promise<Array<UsernameByStateRow>> {
		return fetchMany<UsernameByStateRow>(FETCH_USERNAMES_BY_STATE_QUERY.bind({state}));
	}
}
