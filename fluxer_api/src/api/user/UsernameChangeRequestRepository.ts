// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserID} from '@app/api/BrandedTypes';
import {deleteOneOrMany, fetchMany, fetchOne, upsertOne} from '@app/api/database/CassandraQueryExecution';
import {Db} from '@app/api/database/CassandraTypes';
import type {
	UsernameChangeRequestByStatusRow,
	UsernameChangeRequestRow,
	UsernameChangeRequestStatus,
} from '@app/api/database/types/UserTypes';
import {UsernameChangeRequests, UsernameChangeRequestsByStatus} from '@app/api/Tables';

const FETCH_REQUEST_QUERY = UsernameChangeRequests.select({
	where: UsernameChangeRequests.where.eq('user_id'),
	limit: 1,
});

const FETCH_PENDING_QUERY = UsernameChangeRequestsByStatus.select({
	where: UsernameChangeRequestsByStatus.where.eq('status'),
});

// Each user's latest rename request, plus the queue of pending ones admins review.
export class UsernameChangeRequestRepository {
	async get(userId: UserID): Promise<UsernameChangeRequestRow | null> {
		return fetchOne<UsernameChangeRequestRow>(FETCH_REQUEST_QUERY.bind({user_id: userId}));
	}

	async createPending(userId: UserID, requestedUsername: string): Promise<UsernameChangeRequestRow> {
		const row: UsernameChangeRequestRow = {
			user_id: userId,
			requested_username: requestedUsername,
			status: 'pending',
			created_at: new Date(),
			reviewed_at: null,
			reviewer_id: null,
		};
		await upsertOne(UsernameChangeRequests.upsertAll(row));
		await upsertOne(
			UsernameChangeRequestsByStatus.upsertAll({status: 'pending', created_at: row.created_at, user_id: userId}),
		);
		return row;
	}

	async close(
		request: UsernameChangeRequestRow,
		status: Exclude<UsernameChangeRequestStatus, 'pending'>,
		reviewerId: UserID | null,
	): Promise<void> {
		await upsertOne(
			UsernameChangeRequests.patchByPk(
				{user_id: request.user_id},
				{status: Db.set(status), reviewed_at: Db.set(new Date()), reviewer_id: Db.set(reviewerId)},
			),
		);
		await deleteOneOrMany(
			UsernameChangeRequestsByStatus.deleteByPk({
				status: 'pending',
				created_at: request.created_at,
				user_id: request.user_id,
			}),
		);
	}

	async listPending(): Promise<Array<UsernameChangeRequestByStatusRow>> {
		const rows = await fetchMany<UsernameChangeRequestByStatusRow>(FETCH_PENDING_QUERY.bind({status: 'pending'}));
		return rows.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
	}
}
