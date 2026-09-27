// SPDX-License-Identifier: AGPL-3.0-or-later

import {mapCosmeticToResponse} from '@app/api/cosmetics/CosmeticMappers';
import {LoginRequired} from '@app/api/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import {OpenAPI} from '@app/api/middleware/ResponseTypeMiddleware';
import {getCosmeticRegistry} from '@app/api/middleware/ServiceSingletons';
import {RateLimitConfigs} from '@app/api/RateLimitConfig';
import type {HonoApp} from '@app/api/types/HonoEnv';
import {CosmeticListResponse} from '@fluxer/schema/src/domains/cosmetics/CosmeticSchemas';

export function CosmeticController(app: HonoApp) {
	app.get(
		'/cosmetics',
		RateLimitMiddleware(RateLimitConfigs.COSMETICS_LIST),
		LoginRequired,
		OpenAPI({
			operationId: 'list_cosmetics',
			summary: 'List uploaded cosmetics',
			responseSchema: CosmeticListResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Lists the avatar frames and nameplates an admin uploaded, newest first. Every account can use them. Built-in cosmetics drawn by the client are not listed.',
		}),
		async (ctx) => {
			const rows = await getCosmeticRegistry().list();
			rows.sort((a, b) => (a.cosmetic_id === b.cosmetic_id ? 0 : a.cosmetic_id > b.cosmetic_id ? -1 : 1));
			return ctx.json({cosmetics: rows.map(mapCosmeticToResponse)});
		},
	);
}
