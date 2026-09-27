// SPDX-License-Identifier: AGPL-3.0-or-later

import {deleteOneOrMany, fetchMany, fetchOne, upsertOne} from '@app/api/database/CassandraQueryExecution';
import {COSMETIC_BUCKET, type CosmeticRow} from '@app/api/database/types/CosmeticTypes';
import {Cosmetics} from '@app/api/Tables';

const LIST_COSMETICS_QUERY = Cosmetics.select({
	where: Cosmetics.where.eq('bucket'),
});

const FETCH_COSMETIC_QUERY = Cosmetics.select({
	where: [Cosmetics.where.eq('bucket'), Cosmetics.where.eq('cosmetic_id')],
	limit: 1,
});

export interface ICosmeticRegistry {
	list(): Promise<Array<CosmeticRow>>;
	get(cosmeticId: bigint): Promise<CosmeticRow | null>;
	create(row: Omit<CosmeticRow, 'bucket'>): Promise<CosmeticRow>;
	delete(cosmeticId: bigint): Promise<void>;
}

export class CosmeticRegistry implements ICosmeticRegistry {
	async list(): Promise<Array<CosmeticRow>> {
		return fetchMany<CosmeticRow>(LIST_COSMETICS_QUERY.bind({bucket: COSMETIC_BUCKET}));
	}

	async get(cosmeticId: bigint): Promise<CosmeticRow | null> {
		return fetchOne<CosmeticRow>(FETCH_COSMETIC_QUERY.bind({bucket: COSMETIC_BUCKET, cosmetic_id: cosmeticId}));
	}

	async create(row: Omit<CosmeticRow, 'bucket'>): Promise<CosmeticRow> {
		const full: CosmeticRow = {bucket: COSMETIC_BUCKET, ...row};
		await upsertOne(Cosmetics.upsertAll(full));
		return full;
	}

	async delete(cosmeticId: bigint): Promise<void> {
		await deleteOneOrMany(Cosmetics.deleteByPk({bucket: COSMETIC_BUCKET, cosmetic_id: cosmeticId}));
	}
}
