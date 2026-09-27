// SPDX-License-Identifier: AGPL-3.0-or-later

import type {CosmeticRow} from '@app/api/database/types/CosmeticTypes';
import type {AdminCosmeticResponse, CosmeticResponse} from '@fluxer/schema/src/domains/cosmetics/CosmeticSchemas';

export function mapCosmeticToResponse(row: CosmeticRow): CosmeticResponse {
	return {
		id: row.cosmetic_id.toString(),
		kind: row.kind,
		name: row.name,
		animated: row.animated,
	};
}

export function mapCosmeticToAdminResponse(row: CosmeticRow): AdminCosmeticResponse {
	return {
		...mapCosmeticToResponse(row),
		creator_id: row.creator_id.toString(),
		created_at: row.created_at.toISOString(),
	};
}
