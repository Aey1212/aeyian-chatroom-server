// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GuildID, SoundboardSoundID, UserID} from '@app/api/BrandedTypes';
import type {GuildSoundboardSoundRow} from '@app/api/database/types/GuildTypes';

export class GuildSoundboardSound {
	readonly guildId: GuildID;
	readonly soundId: SoundboardSoundID;
	readonly name: string;
	readonly emojiId: bigint | null;
	readonly emojiName: string | null;
	readonly volume: number;
	readonly creatorId: UserID;
	readonly hash: string;
	readonly extension: string;
	readonly contentType: string;
	readonly durationMs: number;
	readonly sizeBytes: number;
	readonly createdAt: Date;
	readonly version: number;

	constructor(row: GuildSoundboardSoundRow) {
		this.guildId = row.guild_id;
		this.soundId = row.sound_id;
		this.name = row.name;
		this.emojiId = row.emoji_id ?? null;
		this.emojiName = row.emoji_name ?? null;
		this.volume = row.volume;
		this.creatorId = row.creator_id;
		this.hash = row.hash;
		this.extension = row.extension;
		this.contentType = row.content_type;
		this.durationMs = row.duration_ms;
		this.sizeBytes = row.size_bytes;
		this.createdAt = row.created_at;
		this.version = row.version;
	}

	toRow(): GuildSoundboardSoundRow {
		return {
			guild_id: this.guildId,
			sound_id: this.soundId,
			name: this.name,
			emoji_id: this.emojiId,
			emoji_name: this.emojiName,
			volume: this.volume,
			creator_id: this.creatorId,
			hash: this.hash,
			extension: this.extension,
			content_type: this.contentType,
			duration_ms: this.durationMs,
			size_bytes: this.sizeBytes,
			created_at: this.createdAt,
			version: this.version,
		};
	}
}
