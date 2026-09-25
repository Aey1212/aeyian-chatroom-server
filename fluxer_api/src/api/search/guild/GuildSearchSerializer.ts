// SPDX-License-Identifier: AGPL-3.0-or-later

import type {Guild} from '@app/api/models/Guild';
import {GuildFeatures, getEffectiveGuildVerificationLevel} from '@fluxer/constants/src/GuildConstants';
import type {SearchableGuild} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';
import {snowflakeToDate} from '@fluxer/snowflake/src/Snowflake';

export function convertToSearchableGuild(guild: Guild): SearchableGuild {
	const createdAt = Math.floor(snowflakeToDate(BigInt(guild.id)).getTime() / 1000);
	return {
		id: guild.id.toString(),
		ownerId: guild.ownerId.toString(),
		name: guild.name,
		vanityUrlCode: guild.vanityUrlCode,
		iconHash: guild.iconHash,
		bannerHash: guild.bannerHash,
		splashHash: guild.splashHash,
		features: Array.from(guild.features),
		verificationLevel: getEffectiveGuildVerificationLevel(
			guild.verificationLevel,
			guild.features.has(GuildFeatures.DISCOVERABLE),
		),
		mfaLevel: guild.mfaLevel,
		nsfwLevel: guild.nsfwLevel,
		createdAt,
		memberCount: guild.memberCount,
	};
}
