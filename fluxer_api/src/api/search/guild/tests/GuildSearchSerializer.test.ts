// SPDX-License-Identifier: AGPL-3.0-or-later

import {createChannelID, createGuildID, createUserID} from '@app/api/BrandedTypes';
import type {GuildRow} from '@app/api/database/types/GuildTypes';
import {Guild} from '@app/api/models/Guild';
import {convertToSearchableGuild} from '@app/api/search/guild/GuildSearchSerializer';
import {GuildFeatures, GuildVerificationLevel} from '@fluxer/constants/src/GuildConstants';
import {describe, expect, it} from 'vitest';

function guildRow(features: Set<string>): GuildRow {
	return {
		guild_id: createGuildID(1472623911696138261n),
		owner_id: createUserID(1472623911696138262n),
		name: 'FluxDiscover',
		vanity_url_code: null,
		icon_hash: null,
		banner_hash: null,
		banner_width: null,
		banner_height: null,
		splash_hash: null,
		splash_width: null,
		splash_height: null,
		splash_card_alignment: null,
		embed_splash_hash: null,
		embed_splash_width: null,
		embed_splash_height: null,
		features,
		verification_level: 0,
		mfa_level: 0,
		nsfw_level: 0,
		nsfw: false,
		content_warning_level: 0,
		content_warning_text: null,
		explicit_content_filter: 0,
		default_message_notifications: 0,
		system_channel_id: createChannelID(1472623911696138263n),
		system_channel_flags: 0,
		rules_channel_id: null,
		afk_channel_id: null,
		afk_timeout: 0,
		disabled_operations: 0,
		member_count: 42,
		audit_logs_indexed_at: null,
		members_indexed_at: null,
		message_history_cutoff: null,
		version: 1,
	};
}

describe('GuildSearchSerializer', () => {
	it('indexes the guild fields searches filter and sort on', () => {
		const result = convertToSearchableGuild(new Guild(guildRow(new Set())));
		expect(result.id).toBe('1472623911696138261');
		expect(result.ownerId).toBe('1472623911696138262');
		expect(result.name).toBe('FluxDiscover');
		expect(result.memberCount).toBe(42);
		expect(result.verificationLevel).toBe(0);
		expect(result).not.toHaveProperty('isDiscoverable');
	});
	it('reports the raised verification level of a guild with the DISCOVERABLE feature', () => {
		const result = convertToSearchableGuild(new Guild(guildRow(new Set([GuildFeatures.DISCOVERABLE]))));
		expect(result.features).toContain(GuildFeatures.DISCOVERABLE);
		expect(result.verificationLevel).toBe(GuildVerificationLevel.LOW);
	});
});
