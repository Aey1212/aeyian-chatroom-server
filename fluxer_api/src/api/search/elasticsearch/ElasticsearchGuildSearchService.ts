// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GuildID} from '@app/api/BrandedTypes';
import type {Guild} from '@app/api/models/Guild';
import {convertToSearchableGuild} from '@app/api/search/guild/GuildSearchSerializer';
import type {IGuildSearchService} from '@app/api/search/IGuildSearchService';
import {SearchAdapterServiceBase} from '@app/api/search/SearchAdapterServiceBase';
import type {
	SearchOptions as SchemaSearchOptions,
	SearchResult as SchemaSearchResult,
} from '@fluxer/schema/src/contracts/search/SearchAdapterTypes';
import type {GuildSearchFilters, SearchableGuild} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';
import {
	ElasticsearchGuildAdapter,
	type ElasticsearchGuildAdapterOptions,
} from '@pkgs/elasticsearch_search/src/adapters/ElasticsearchGuildAdapter';

export class ElasticsearchGuildSearchService
	extends SearchAdapterServiceBase<GuildSearchFilters, SearchableGuild, ElasticsearchGuildAdapter>
	implements IGuildSearchService
{
	constructor(options: ElasticsearchGuildAdapterOptions) {
		super(new ElasticsearchGuildAdapter({client: options.client, lock: options.lock}));
	}

	async indexGuild(guild: Guild): Promise<void> {
		await this.indexDocument(convertToSearchableGuild(guild));
	}

	async indexGuilds(guilds: Array<Guild>): Promise<void> {
		if (guilds.length === 0) return;
		await this.indexDocuments(guilds.map((guild) => convertToSearchableGuild(guild)));
	}

	async updateGuild(guild: Guild): Promise<void> {
		await this.updateDocument(convertToSearchableGuild(guild));
	}

	async deleteGuild(guildId: GuildID): Promise<void> {
		await this.deleteDocument(guildId.toString());
	}

	async deleteGuilds(guildIds: Array<GuildID>): Promise<void> {
		await this.deleteDocuments(guildIds.map((id) => id.toString()));
	}

	searchGuilds(
		query: string,
		filters: GuildSearchFilters,
		options?: SchemaSearchOptions,
	): Promise<SchemaSearchResult<SearchableGuild>> {
		return this.search(query, filters, options);
	}
}
