// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserID} from '@app/api/BrandedTypes';
import type {CosmeticKind} from '@fluxer/constants/src/CosmeticConstants';

// Uploaded avatar frames and nameplates. Every row shares one partition (bucket 0) so the whole
// catalog is a single read; it stays small because only admins add to it.
export interface CosmeticRow {
	bucket: number;
	cosmetic_id: bigint;
	kind: CosmeticKind;
	name: string;
	animated: boolean;
	creator_id: UserID;
	created_at: Date;
}

export const COSMETIC_BUCKET = 0;

export const COSMETIC_COLUMNS = [
	'bucket',
	'cosmetic_id',
	'kind',
	'name',
	'animated',
	'creator_id',
	'created_at',
] as const satisfies ReadonlyArray<keyof CosmeticRow>;
