// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GuildID} from '@app/api/BrandedTypes';
import {mapGuildToGuildResponse} from '@app/api/guild/GuildModel';
import type {IGatewayService} from '@app/api/infrastructure/IGatewayService';
import {Logger} from '@app/api/Logger';
import type {Guild} from '@app/api/models/Guild';
import {getGuildSearchService} from '@app/api/SearchFactory';

interface AdminGuildUpdatePropagatorDeps {
	gatewayService: IGatewayService;
}

export class AdminGuildUpdatePropagator {
	constructor(private readonly deps: AdminGuildUpdatePropagatorDeps) {}

	async dispatchGuildUpdate(guildId: GuildID, updatedGuild: Guild): Promise<void> {
		await this.deps.gatewayService.dispatchGuild({
			guildId,
			event: 'GUILD_UPDATE',
			data: mapGuildToGuildResponse(updatedGuild),
		});
		const guildSearchService = getGuildSearchService();
		if (guildSearchService) {
			await guildSearchService.updateGuild(updatedGuild).catch((error) => {
				Logger.error({guildId, error}, 'Failed to update guild in search after admin update');
			});
		}
	}
}
