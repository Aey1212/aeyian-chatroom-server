// SPDX-License-Identifier: AGPL-3.0-or-later

import {AdminAuditReadActions} from '@app/api/admin/AdminAuditActions';
import {recordAdminRead} from '@app/api/admin/AdminAuditRecorder';
import {requireAdminACL} from '@app/api/middleware/AdminMiddleware';
import {RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import {OpenAPI} from '@app/api/middleware/ResponseTypeMiddleware';
import {AdminRateLimitConfigs} from '@app/api/rate_limit_configs/AdminRateLimitConfig';
import type {HonoApp} from '@app/api/types/HonoEnv';
import {Validator} from '@app/api/Validator';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {
	AdminCosmeticCreateRequest,
	AdminCosmeticDeleteResponse,
	AdminCosmeticListResponse,
	AdminCosmeticResponse,
	CosmeticIdParam,
} from '@fluxer/schema/src/domains/cosmetics/CosmeticSchemas';

export function CosmeticAdminController(app: HonoApp) {
	app.get(
		'/admin/cosmetics',
		RateLimitMiddleware(AdminRateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.COSMETICS_MANAGE),
		OpenAPI({
			operationId: 'list_admin_cosmetics',
			summary: 'List cosmetics',
			responseSchema: AdminCosmeticListResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'List every uploaded avatar frame and nameplate with its uploader, newest first. Requires COSMETICS_MANAGE permission.',
		}),
		async (ctx) => {
			const response = await ctx.get('adminService').cosmeticService.list();
			await recordAdminRead(ctx, {
				targetType: 'cosmetic',
				targetId: 0n,
				action: AdminAuditReadActions.LIST_COSMETICS,
				metadata: {entry_count: response.cosmetics.length},
			});
			return ctx.json(response);
		},
	);
	app.post(
		'/admin/cosmetics',
		RateLimitMiddleware(AdminRateLimitConfigs.ADMIN_COSMETIC_MODIFY),
		requireAdminACL(AdminACLs.COSMETICS_MANAGE),
		Validator('json', AdminCosmeticCreateRequest),
		OpenAPI({
			operationId: 'create_admin_cosmetic',
			summary: 'Upload a cosmetic',
			responseSchema: AdminCosmeticResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Upload an avatar frame or a nameplate that every account can then choose. Accepts PNG, JPEG, WebP, GIF and AVIF up to 2 MiB; animated images are kept. Creates audit log entry. Requires COSMETICS_MANAGE permission.',
		}),
		async (ctx) => {
			return ctx.json(
				await ctx
					.get('adminService')
					.cosmeticService.create(ctx.req.valid('json'), ctx.get('adminUserId'), ctx.get('auditLogReason')),
			);
		},
	);
	app.delete(
		'/admin/cosmetics/:cosmetic_id',
		RateLimitMiddleware(AdminRateLimitConfigs.ADMIN_COSMETIC_MODIFY),
		requireAdminACL(AdminACLs.COSMETICS_MANAGE),
		Validator('param', CosmeticIdParam),
		OpenAPI({
			operationId: 'delete_admin_cosmetic',
			summary: 'Delete a cosmetic',
			responseSchema: AdminCosmeticDeleteResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Remove an uploaded avatar frame or nameplate and its image. Accounts that chose it show nothing in its place. Returns deleted false when no such cosmetic exists. Creates audit log entry. Requires COSMETICS_MANAGE permission.',
		}),
		async (ctx) => {
			return ctx.json(
				await ctx
					.get('adminService')
					.cosmeticService.delete(
						ctx.req.valid('param').cosmetic_id,
						ctx.get('adminUserId'),
						ctx.get('auditLogReason'),
					),
			);
		},
	);
}
