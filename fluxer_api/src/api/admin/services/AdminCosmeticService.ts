// SPDX-License-Identifier: AGPL-3.0-or-later

import type {AdminAuditService} from '@app/api/admin/services/AdminAuditService';
import type {UserID} from '@app/api/BrandedTypes';
import {mapCosmeticToAdminResponse} from '@app/api/cosmetics/CosmeticMappers';
import type {ICosmeticRegistry} from '@app/api/cosmetics/CosmeticRegistry';
import type {AvatarService} from '@app/api/infrastructure/AvatarService';
import type {ISnowflakeService} from '@app/api/infrastructure/ISnowflakeService';
import type {
	AdminCosmeticCreateRequest,
	AdminCosmeticDeleteResponse,
	AdminCosmeticListResponse,
	AdminCosmeticResponse,
} from '@fluxer/schema/src/domains/cosmetics/CosmeticSchemas';

interface AdminCosmeticServiceDeps {
	cosmeticRegistry: ICosmeticRegistry;
	avatarService: AvatarService;
	snowflakeService: ISnowflakeService;
	auditService: AdminAuditService;
}

// Uploaded avatar frames and nameplates. Users pick them in their profile settings.
export class AdminCosmeticService {
	constructor(private readonly deps: AdminCosmeticServiceDeps) {}

	async list(): Promise<AdminCosmeticListResponse> {
		const rows = await this.deps.cosmeticRegistry.list();
		return {cosmetics: sortNewestFirst(rows).map(mapCosmeticToAdminResponse)};
	}

	async create(
		data: AdminCosmeticCreateRequest,
		adminUserId: UserID,
		auditLogReason: string | null,
	): Promise<AdminCosmeticResponse> {
		const {imageBuffer, animated, contentType} = await this.deps.avatarService.processCosmetic({
			errorPath: 'image',
			base64Image: data.image,
		});
		const cosmeticId = await this.deps.snowflakeService.generate();
		await this.deps.avatarService.uploadCosmetic({cosmeticId, imageBuffer, contentType});
		const row = await this.deps.cosmeticRegistry.create({
			cosmetic_id: cosmeticId,
			kind: data.kind,
			name: data.name,
			animated,
			creator_id: adminUserId,
			created_at: new Date(),
		});
		await this.deps.auditService.createAuditLog({
			adminUserId,
			targetType: 'cosmetic',
			targetId: cosmeticId,
			action: 'create_cosmetic',
			auditLogReason,
			metadata: new Map([
				['kind', data.kind],
				['name', data.name],
			]),
		});
		return mapCosmeticToAdminResponse(row);
	}

	async delete(
		cosmeticId: bigint,
		adminUserId: UserID,
		auditLogReason: string | null,
	): Promise<AdminCosmeticDeleteResponse> {
		const row = await this.deps.cosmeticRegistry.get(cosmeticId);
		if (!row) {
			return {deleted: false};
		}
		await this.deps.cosmeticRegistry.delete(cosmeticId);
		await this.deps.avatarService.deleteCosmetic(cosmeticId);
		await this.deps.auditService.createAuditLog({
			adminUserId,
			targetType: 'cosmetic',
			targetId: cosmeticId,
			action: 'delete_cosmetic',
			auditLogReason,
			metadata: new Map([
				['kind', row.kind],
				['name', row.name],
			]),
		});
		return {deleted: true};
	}
}

function sortNewestFirst<T extends {cosmetic_id: bigint}>(rows: ReadonlyArray<T>): Array<T> {
	return [...rows].sort((a, b) => (a.cosmetic_id === b.cosmetic_id ? 0 : a.cosmetic_id > b.cosmetic_id ? -1 : 1));
}
